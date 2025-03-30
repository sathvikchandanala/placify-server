function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // Escapes special characters
  }
  
  
  async function parseResume(file) {
    try {
      // Simple text extraction for all file types
      return file.data.toString('utf8');
    } catch (error) {
      console.error('Error parsing resume:', error);
      throw new Error(`Error parsing resume: ${error.message}`);
    }
  }
  
  function extractCriticalKeywords(jobDesc) {
    // Core technical skills that are commonly valued
    const commonTechSkills = [
      'javascript', 'python', 'java', 'react', 'node', 'angular', 'vue',
      'typescript', 'c\\+\\+', 'csharp', 'ruby', 'php', 'swift', 'kotlin',
      'golang', 'rust', 'scala', 'perl', 'r', 'matlab'
    ];
  
    // Framework and library keywords
    const frameworks = [
      'express', 'django', 'flask', 'spring', 'laravel', 'rails',
      'nextjs', 'gatsby', 'nuxt', 'fastapi', 'nestjs'
    ];
  
    // Database technologies
    const databases = [
      'sql', 'mysql', 'postgresql', 'mongodb', 'redis', 'elasticsearch',
      'dynamodb', 'cassandra', 'oracle', 'firebase'
    ];
  
    // Cloud and DevOps
    const cloudDevOps = [
      'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'jenkins', 'gitlab',
      'terraform', 'ansible', 'prometheus', 'grafana', 'cicd'
    ];
  
    return [...commonTechSkills, ...frameworks, ...databases, ...cloudDevOps];
  }
  
  function extractTechnicalKeywords(jobDesc) {
    // Development tools and practices
    const devTools = [
      'git', 'github', 'gitlab', 'bitbucket', 'jira', 'confluence',
      'swagger', 'postman', 'webpack', 'babel', 'vite', 'npm', 'yarn'
    ];
  
    // Testing related keywords
    const testing = [
      'jest', 'mocha', 'cypress', 'selenium', 'junit', 'pytest',
      'tdd', 'bdd', 'unit testing', 'integration testing', 'e2e testing'
    ];
  
    // Architecture and patterns
    const architecture = [
      'mvc', 'mvvm', 'rest', 'graphql', 'microservices', 'serverless',
      'api', 'soap', 'oauth', 'jwt', 'design patterns'
    ];
  
    // Security
    const security = [
      'oauth', 'jwt', 'authentication', 'authorization', 'encryption',
      'csrf', 'xss', 'sql injection', 'security', 'penetration testing'
    ];
  
    return [...devTools, ...testing, ...architecture, ...security];
  }
  
  function extractSoftSkills(jobDesc) {
    return [
      // Leadership and Management
      'leadership', 'team management', 'project management', 'mentoring',
      'strategic thinking', 'decision making', 'conflict resolution',
      
      // Communication
      'communication', 'presentation', 'documentation', 'collaboration',
      'interpersonal skills', 'stakeholder management',
      
      // Problem Solving
      'problem solving', 'analytical', 'critical thinking', 'troubleshooting',
      'debugging', 'root cause analysis',
      
      // Work Attributes
      'time management', 'organization', 'multitasking', 'deadline',
      'attention to detail', 'self-motivated', 'initiative',
      
      // Team Skills
      'teamwork', 'collaboration', 'cross-functional', 'team player',
      'agile', 'scrum', 'remote work'
    ];
  }
  
  function calculateKeywordScore(resume, jobDesc) {
    const keywordCategories = {
      critical: extractCriticalKeywords(jobDesc),
      technical: extractTechnicalKeywords(jobDesc),
      soft: extractSoftSkills(jobDesc)
    };
  
    let totalScore = 0;
    const weights = { critical: 0.5, technical: 0.3, soft: 0.2 };
  
    Object.entries(keywordCategories).forEach(([category, keywords]) => {
      const categoryScore = keywords.reduce((score, keyword) => {
        const escapedKeyword = escapeRegExp(keyword);
        const keywordRegex = new RegExp(`\\b${escapedKeyword}\\b`, 'gi');
        const matches = (resume.match(keywordRegex) || []).length;
        return score + (matches > 0 ? 1 : 0);
      }, 0) / keywords.length * 100;
  
      totalScore += categoryScore * weights[category];
    });
  
    return totalScore;
  }
  
  function calculateExperienceScore(resume) {
    let score = 60;
    const experienceKeywords = [
      'years experience', 'year experience',
      'project', 'developed', 'implemented', 'managed',
      'lead', 'team', 'production', 'deployed',
      'architected', 'designed', 'optimized', 'reduced',
      'increased', 'improved', 'launched', 'delivered'
    ];
  
    experienceKeywords.forEach(keyword => {
      if (resume.toLowerCase().includes(keyword.toLowerCase())) {
        score += 5;
      }
    });
  
    // Additional points for quantifiable achievements
    const metrics = resume.match(/(\d+%|\$\d+|\d+ years|\d+ users|\d+ projects)/g) || [];
    score += Math.min(metrics.length * 5, 20); // Up to 20 points for metrics
  
    return Math.min(score, 100);
  }
  
  function calculateEducationScore(resume) {
    let score = 50;
    if (resume.toLowerCase().includes('phd')) score += 50;
    else if (resume.toLowerCase().includes('master')) score += 40;
    else if (resume.toLowerCase().includes('bachelor')) score += 30;
  
    const relevantMajors = [
      'computer science', 'software engineering',
      'information technology', 'computer engineering',
      'data science', 'artificial intelligence',
      'cybersecurity', 'information systems'
    ];
  
    // Points for relevant majors
    relevantMajors.forEach(major => {
      if (resume.toLowerCase().includes(major.toLowerCase())) {
        score += 10;
      }
    });
  
    // Points for certifications
    const certifications = [
      'aws certified', 'azure certified', 'google certified',
      'cissp', 'ceh', 'comptia', 'pmp', 'agile', 'scrum'
    ];
  
    certifications.forEach(cert => {
      if (resume.toLowerCase().includes(cert.toLowerCase())) {
        score += 5;
      }
    });
  
    return Math.min(score, 100);
  }
  
  function calculateFormatScore(resumeText) {
    console.log(resumeText);
    let score = 100;
    const lowerText = resumeText.toLowerCase();
  
    // Check for essential sections (less strict penalties)
    const essentialSections = {
      'experience': 15,    // Reduced from 20
      'education': 10,     // Reduced from 15
      'skills': 10,        // Reduced from 15
      'projects': 5        // Reduced from 10
    };
  
    let sectionsFound = 0;
    Object.entries(essentialSections).forEach(([section, points]) => {
      if (lowerText.includes(section)) {
        sectionsFound++;
      } else {
        score -= points;
      }
    });
  
    // Bonus points for having most sections
    if (sectionsFound >= 3) {
      score += 10;
    }
  
    // Check for contact information (reduced penalties)
    const contactElements = {
      'email': 5,          // Reduced from 10
      'phone': 5,          // Reduced from 10
      'linkedin': 3,       // Reduced from 5
      'github': 3          // Reduced from 5
    };
  
    let contactFound = 0;
    Object.entries(contactElements).forEach(([element, points]) => {
      if (lowerText.includes(element)) {
        contactFound++;
      } else {
        score -= points;
      }
    });
  
    // Bonus for having multiple contact methods
    if (contactFound >= 2) {
      score += 5;
    }
  
    // Check for proper length (adjusted thresholds)
    const words = resumeText.split(/\s+/).length;
    if (words < 100) score -= 15;        // Reduced penalty and threshold
    else if (words < 200) score -= 10;   // Added intermediate threshold
    if (words > 2000) score -= 10;       // Increased threshold
  
    // Check for formatting elements
    const bulletPoints = (resumeText.match(/[•\-\*]/g) || []).length;
    if (bulletPoints < 3) score -= 5;     // Reduced threshold and penalty
    
    // Check for dates (more lenient)
    const hasDate = /\d{4}|\d{2}\/\d{2}|\d{2}\-\d{2}|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i.test(resumeText);
    if (!hasDate) score -= 5;
  
    // Check for action verbs
    const actionVerbs = [
      'developed', 'implemented', 'created', 'managed', 'led',
      'designed', 'built', 'improved', 'achieved', 'increased',
      'decreased', 'coordinated', 'organized', 'analyzed'
    ];
    
    const hasActionVerbs = actionVerbs.some(verb => lowerText.includes(verb));
    if (hasActionVerbs) {
      score += 5; // Bonus for using action verbs
    }
  
    // Additional bonus points
    if (bulletPoints >= 10) score += 5;   // Bonus for good use of bullets
    if (words >= 300 && words <= 1000) score += 5;  // Bonus for ideal length
  
    // Ensure score stays within bounds
    return Math.min(Math.max(score, 30), 100); // Minimum score of 30
  }
  
  function findMatchingKeywords(resume, jobDesc) {
    const allKeywords = [
      ...extractCriticalKeywords(jobDesc),
      ...extractTechnicalKeywords(jobDesc),
      ...extractSoftSkills(jobDesc)
    ];
  
    return [...new Set(allKeywords.filter(keyword => 
      resume.toLowerCase().includes(keyword.toLowerCase()) && 
      jobDesc.toLowerCase().includes(keyword.toLowerCase())
    ))];
  }
  
  function findMissingKeywords(resume, jobDesc) {
    const allKeywords = [
      ...extractCriticalKeywords(jobDesc),
      ...extractTechnicalKeywords(jobDesc),
      ...extractSoftSkills(jobDesc)
    ];
  
    return [...new Set(allKeywords.filter(keyword => 
      !resume.toLowerCase().includes(keyword.toLowerCase()) && 
      jobDesc.toLowerCase().includes(keyword.toLowerCase())
    ))];
  }
  
  async function calculateATSScore(resumeText, jobDescription) {
    const resumeLower = resumeText.toLowerCase();
    const jobDescLower = jobDescription.toLowerCase();
  
    const keywordScore = calculateKeywordScore(resumeLower, jobDescLower);
    const experienceScore = calculateExperienceScore(resumeLower);
    const educationScore = calculateEducationScore(resumeLower);
    const formatScore = calculateFormatScore(resumeText);
  
    const finalScore = (
      (keywordScore * 0.35) +
      (experienceScore * 0.30) +
      (educationScore * 0.20) +
      (formatScore * 0.15)
    );
  
    return {
      score: Math.round(finalScore),
      details: {
        keywordMatch: Math.round(keywordScore),
        experienceMatch: Math.round(experienceScore),
        educationMatch: Math.round(educationScore),
        formatMatch: Math.round(formatScore)
      },
      matches: findMatchingKeywords(resumeLower, jobDescLower),
      missingKeywords: findMissingKeywords(resumeLower, jobDescLower),
      recommendations: generateRecommendations(finalScore, keywordScore, experienceScore, educationScore, formatScore)
    };
  }
  
  function generateRecommendations(totalScore, keywordScore, experienceScore, educationScore, formatScore) {
    const recommendations = [];
  
    if (keywordScore < 70) {
      recommendations.push(
        "Add more relevant technical skills and keywords from the job description",
        "Include specific technologies and tools mentioned in the job posting",
        "Add industry-standard certifications and qualifications",
        "Highlight technical proficiencies that align with the role"
      );
    }
  
    if (experienceScore < 70) {
      recommendations.push(
        "Quantify your achievements with specific metrics and numbers",
        "Use strong action verbs to describe your responsibilities",
        "Include specific project details and outcomes",
        "Highlight leadership and team collaboration experiences"
      );
    }
  
    if (educationScore < 70) {
      recommendations.push(
        "Emphasize your educational qualifications",
        "Include relevant certifications or additional training",
        "List any specialized courses or bootcamps",
        "Mention academic projects relevant to the position"
      );
    }
  
    if (formatScore < 70) {
      recommendations.push(
        "Ensure your resume has clear sections for experience, education, and skills",
        "Use consistent formatting throughout the document",
        "Include bullet points for better readability",
        "Add proper contact information and professional links",
        "Use proper spacing and alignment",
        "Include dates in a consistent format",
        "Keep resume length between 1-2 pages",
        "Use industry-standard section headings"
      );
    }
  
    return recommendations;
  }
  
  export { parseResume, calculateATSScore };
  
  