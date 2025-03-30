import natural from "natural";
import stopword from "stopword";

function preprocessText(text) {
    const tokenizer = new natural.WordTokenizer();
    let words = tokenizer.tokenize(text.toLowerCase());
    return stopword.removeStopwords(words);
}

function calculateSimilarity(text1, text2) {
    const tfidf = new natural.TfIdf();
    const processedText1 = preprocessText(text1);
    const processedText2 = preprocessText(text2);

    tfidf.addDocument(processedText1);
    tfidf.addDocument(processedText2);

    const vector1 = tfidf.listTerms(0).map(term => Math.log(1 + term.tfidf));
    const vector2 = tfidf.listTerms(1).map(term => Math.log(1 + term.tfidf));

    function cosineSimilarity(vecA, vecB) {
        const dotProduct = vecA.reduce((sum, a, i) => sum + a * (vecB[i] || 0), 0);
        const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a ** 2, 0));
        const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b ** 2, 0));
        return magnitudeA && magnitudeB ? dotProduct / (magnitudeA * magnitudeB) : 0;
    }

    const score = cosineSimilarity(vector1, vector2);

    function levenshteinSimilarity(str1, str2) {
        return 1 - natural.LevenshteinDistance(str1, str2) / Math.max(str1.length, str2.length);
    }

    const refinedScore = (score * 0.8) + (levenshteinSimilarity(text1, text2) * 0.2);

    const matchingTerms = processedText1.filter(word => processedText2.includes(word));

    return { score: refinedScore, matchingTerms: [...new Set(matchingTerms)] };
}

export default calculateSimilarity;
