import express from "express";
import bcryt from "bcrypt";
import { User } from "../models/user.js";
import { Company } from "../models/Company.js";
import { Interview } from "../models/Experience.js";
import { CompanyData } from "../models/CompanyData.js";
import jwt from "jsonwebtoken";
import axios from 'axios';
import nodemailer from "nodemailer";
import fileUpload from 'express-fileupload';
import ExcelJS from 'exceljs';
import mongoose from "mongoose";
import { GoogleGenerativeAI } from '@google/generative-ai'
import twilio from 'twilio';

const router = express.Router();
router.use(fileUpload());


router.post('/atsScore', async (req, res) => {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY);
    const { parsedResumeText, jobDescription } = req.body;
    
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro"});

    const prompt = `
    Provide an ATS analysis in STRICTLY FORMATTED JSON. 
    Analyze the resume against the job description and generate:
    - A score between 0-100
    - 3-5 specific recommendations for improvement
    - Missing keywords that would strengthen the resume

    IMPORTANT: Respond ONLY with a JSON object. No explanatory text before or after.
    Use this EXACT format:
    {
      "score": number,
      "recommendations": string[],
      "missingKeywords": string[]
    }

    Resume:
    ${parsedResumeText}

    Job Description:
    ${jobDescription}

    Response Format (JSON):
    {
      "score": number (0-100),
      "recommendations": string[],
      "missingKeywords": string[]
    }
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    const rel = text
      .replace(/^```json\s*/, '')  
      .replace(/```\s*$/, '')      
      .trim();
    const jsonObject = JSON.parse(rel);

    res.json({
      success: true,
      analysis: jsonObject
    });

  } catch (error) {
    console.error('ATS Score Analysis Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


router.post("/register", async (req, res) => {
  const {
    name,
    email,
    password,
    contactNumber,
    rollNo,
    gender,
    dob,
    pass,
    tenthPercentage,
    twelfthPercentage,
    graduationCGPA,
    stream,
    isAdmin,
  } = req.body;
  const user = await User.findOne({ email });
  if (user) {
    return res.json({ message: "User already existed" });
  }

  const hashpassword = await bcryt.hash(password, 10);
  const newUser = new User({
    name,
    email,
    password: hashpassword,
    contactNumber,
    rollNo,
    gender,
    dob,
    pass,
    tenthPercentage,
    twelfthPercentage,
    graduationCGPA,
    stream,
    isAdmin,
  });

  await newUser.save();
  return res.json({ message: "User Registered" });
});

router.post('/sendLabEmails', async (req, res) => {
  const { studentsWithVenues, companyName, doa } = req.body;
  console.log("date...."+doa);

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,  
    secure: true, 
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD 
    },
    debug: true 
  });

  transporter.verify(function (error, success) {
    if (error) {
      console.log("Transporter verification error:", error);
    } else {
      console.log("Server is ready to send emails");
    }
  });

  try {
    for (const student of studentsWithVenues) {
      console.log("Details...."+student);
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: student.Email,
        subject: `Lab Allocation for ${companyName}`,
        text: `Dear ${student.Name},\n\nYou have been allocated to ${student.Venue} for the lab assessment of ${companyName} on ${doa}.\n\nBest regards,\nPlacement Team`
      };

      await transporter.sendMail(mailOptions);
    }

    res.status(200).json({ message: 'Emails sent successfully' });
  } catch (error) {
    console.error('Email sending error:', error);
    res.status(500).json({ message: 'Failed to send emails', error });
  }
});

router.post("/", async (req, res) => {
  const { email, password } = req.body;
  
  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid User" });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ success: false, message: "Password Incorrect" });
    }

    const token = jwt.sign(
      { _id: user._id, username: user.username },
      process.env.KEY,
      { expiresIn: "1h" }
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "None",
      maxAge: 3600000,
    });

    return res.json({ success: true, role: user.isAdmin === "1" ? "Admin" : "User" });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server Error" });
  }
});

router.post("/logout", (req, res) => {
  res.clearCookie("token", { httpOnly: true, secure: true, sameSite: "None" });
  return res.json({ status: true, message: "Logged Out" });
});

router.get("/auth/check-session", (req, res) => {
  if (req.cookies.token) {
    res.json({ loggedIn: true });
  } else {
    res.json({ loggedIn: false });
  }
});



const verifyUser = async (req, res, next) => {
  try {
    const token = req.cookies.token;
    if (!token) {
      return res.json({ status: false, message: "No Token" });
    }
    jwt.verify(token, process.env.KEY);
    next();
  } catch (err) {
    return res.json(err);
  }
};

router.get("/verify", verifyUser, (req, res) => {
  return res.json({ status: true, message: "Authorized" });
});

router.get("/validate", async (req, res) => {
  try {
    const token = req.cookies.token;
    if (!token) {
      return res.json({ status: false, message: "No Token" });
    }
    const decoded = jwt.verify(token, process.env.KEY);
    const user = await User.findById(decoded._id);
    if (!user) {
      return res.json({ status: false, message: "Invalid User" });
    }
    return res.json({ status: true, user });
  } catch (err) {
    return res.json({ status: false, message: "Invalid Token" });
  }
});

router.get("/currentUser", verifyUser, async (req, res) => {
  try {
    const token = req.cookies.token;
    const decoded = jwt.verify(token, process.env.KEY);
    console.log(decoded);
    const userId = decoded._id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json({ user });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

router.post("/getCompaniesByIds", async (req, res) => {
  const { companyIds } = req.body;
  console.log(companyIds)
  let companies = [];

for (const com of companyIds) {
  const company = await Company.findOne({ _id: com });
  if (company) {
    companies.push(company.companyname);
  }
}
res.json(companies);
});

router.post("/getCompaniesApplied", async (req, res) => {
  const { companyIds } = req.body;
  let companies = [];

for (const com of companyIds) {
  const company = await CompanyData.findOne({ _id: com });
  if (company) {
    companies.push(company.companyname);
  }
}
res.json(companies);
});

router.post("/updateCGPA", async (req, res) => {
  try {
    const { userId, cgpa } = req.body;

    if (!userId || cgpa === undefined || cgpa < 0 || cgpa > 10) {
      return res.status(400).json({ message: "Invalid CGPA value" });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { graduationCGPA: cgpa },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ message: "CGPA updated successfully", user: updatedUser });
  } catch (error) {
    console.error("Error updating CGPA:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});



// This API is designed to handle the functionality of sending a reset password link via email to the user which is valid till 5mins.
router.post("/forgotpassword", async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.json({ message: "User not registered" });
    }
    const token = jwt.sign({ id: user._id }, process.env.KEY, {
      expiresIn: "5m",
    });

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,  // Changed from 587 to 465
      secure: true, // Changed from false to true
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD  // This should be your app password
      },
      debug: true // Add this to see detailed logs
    });
    
    // Add this verification step before using the transporter
    transporter.verify(function (error, success) {
      if (error) {
        console.log("Transporter verification error:", error);
      } else {
        console.log("Server is ready to send emails");
      }
    });


    var mailOptions = {
      from: "jashmehtaa@gmail.com",
      to: email,
      subject: "Reset Password Link",
      text: `http://localhost:3000/resetPassword/${token}`,
    };

    transporter.sendMail(mailOptions, function (error, info) {
      if (error) {
        console.log("eeeeeeror");
        return res.json({ status: true, message: "Error sending the email" });
      } else {
        return res.json({ status: true, message: "Email Sent" });
      }
    });
  } catch (err) {
    console.log(err);
  }
});

router.get("/timeline/:companyId/:rollNo", async (req, res) => {
  try {
    const { companyId, rollNo } = req.params;

    const company = await CompanyData.findById(companyId);
    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    const today = new Date();
    const timelineData = company.assessmentRounds.map(round => ({
      name: round.name,
      completed: round.date ? new Date(round.date) < today : false,
      lab: round.lab !== undefined ? round.lab : null,
      selected: round.selects?.includes(rollNo) ? "Selected" :
                round.selects?.length === 0 ? "Waiting for Results" : "Not Selected",
      date: round.date || null
    }));

    res.status(200).json(timelineData);
  } catch (error) {
    console.error("Error fetching timeline data:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});


router.post('/checklastround/:id/:activity', async (req, res) => {
  try {
      const { id, activity } = req.params;

      const company = await CompanyData.findById(id);

      if (!company) {
          return res.status(404).json({ error: "Company not found" });
      }

      const assessmentRounds = company.assessmentRounds;

      if (!assessmentRounds || assessmentRounds.length === 0) {
          return res.json({ isLast: false });
      }

      const lastActivity = assessmentRounds[assessmentRounds.length - 1].name;

      const isLast = lastActivity === activity;

      console.log("Last round.................."+isLast);

      res.json({ isLast });
  } catch (error) {
      console.error("Error checking last activity:", error);
      res.status(500).json({ error: "Internal Server Error" });
  }
});



router.post("/resetPassword/:token", async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  try {
    const decoded = await jwt.verify(token, process.env.KEY);
    const id = decoded.id;

    const hashPassword = await bcryt.hash(password, 10);

    await User.findByIdAndUpdate({ _id: id }, { password: hashPassword });

    return res.json({ status: true, message: "Updated Password Successfully" });
  } catch (err) {
    console.error(err);
    return res.status(400).json({ status: false, message: "Invalid Token" });
  }
});

router.get("/expired", async (req, res) => {
  try {
    const activeCompanyIds = await Company.find({}, "_id").lean();
    const activeCompanyIdSet = new Set(activeCompanyIds.map((c) => c._id.toString()));

    const expiredCompanies = await CompanyData.find({
      _id: { $nin: Array.from(activeCompanyIdSet) },
      labs: false
    });
    

    res.status(200).json({ expiredCompanies });
  } catch (error) {
    console.error("Error fetching expired companies:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.get('/companies/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const company = await CompanyData.findById(id);

    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }

    res.status(200).json(company);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching company data', error });
  }
});


router.get('/companies/:id/status-check', async (req, res) => {
  try {
    const { id } = req.params;
    const company = await CompanyData.findById(id);

    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    const today = new Date();

    const statusCheck = {
      assessmentRounds: company.assessmentRounds.map(round => ({
        roundName: round.name,
        completed: new Date(round.date) < today  &&  company.expire< round.date,
        lab: round.lab,
        date:round.date,
        done:round.selects.length>0
      }))
    };

    console.log(statusCheck);
    res.status(200).json(statusCheck);
  } catch (error) {
    res.status(500).json({ message: "Error checking company status", error });
  }
});

router.get('/loc/:id', async (req,res)=>{
    try{
      const {id} = req.params;
      const company=await CompanyData.findById(id);
      if(company)
      {
        const location=company.loc;
          res.json({location})
      }
      else
      {
        console.log("error")
         res.status(404).json({ error: "Company not found" })
      }

    }
    catch{
      console.log("error fetching location");
      res.status(500).json({ error: 'Internal Server Error' });
    }
})


router.get('/company-status/:companyId/:rollNo', async (req, res) => {
  try {
      const { companyId, rollNo } = req.params;
      console.log(`Fetching status for Company ID: ${companyId}, Roll No: ${rollNo}`);

      const company = await Company.findById(companyId);
      if (company) {
          return res.json({
              isExpired: false,
              isLabAllocated: false,
              isAssessmentCompleted: false,
              isInterviewCompleted: false,
              isFinalCompleted: false,
              assessmentSelected: "Waiting for Result",
              interviewSelected: "Waiting for Result",
              finalSelected: "Waiting for Result"
          });
      }

      const comp = await CompanyData.findById(companyId);
      if (!comp) {
          return res.status(404).json({ error: "Company not found" });
      }

      const isExpired = true;
      const isLabAllocated = comp.labs || false;
      const isAssessmentCompleted = comp.doa && new Date(comp.doa) < new Date();
      const isInterviewCompleted = comp.doi && new Date(comp.doi) < new Date();
      const isFinalCompleted = comp.finalSelects?.length > 0;

      let assessmentSelected = "Waiting for Result";
      let interviewSelected = "Waiting for Result";
      let finalSelected = "Waiting for Result";

      if (isAssessmentCompleted && comp.assesmentSelects?.length > 0) {
          assessmentSelected = comp.assesmentSelects.includes(rollNo) ? "Selected" : "Not Selected";
      }

      if (isInterviewCompleted && comp.interviewSelects?.length > 0) {
          interviewSelected = comp.interviewSelects.includes(rollNo) ? "Selected" : "Not Selected";
      }

      if (isFinalCompleted) {
          finalSelected = comp.finalSelects.includes(rollNo) ? "Selected" : "Not Selected";
      }

      console.log(`Assessment: ${assessmentSelected}, Interview: ${interviewSelected}, Final: ${finalSelected}`);

      res.json({
          isExpired,
          isLabAllocated,
          isAssessmentCompleted,
          isInterviewCompleted,
          isFinalCompleted,
          assessmentSelected,
          interviewSelected,
          finalSelected
      });
  } catch (error) {
      console.error('Error fetching company status:', error);
      res.status(500).json({ error: 'Internal Server Error' });
  }
});


router.get('/applicant/:id', async (req, res) => {
  try {
      const { id } = req.params;
      const company = await CompanyData.findById(id);

      if (!company) {
          return res.status(404).json({ message: 'Company not found' });
      }

      res.json({
          applied: company.applicants, 
          doa:company.doa
      });
  } catch (error) {
      console.error('Error fetching applicants:', error);
      res.status(500).json({ message: 'Internal server error' });
  }
});

router.put('/labAllocation/:id/:roundName', async (req, res) => {
  console.log("lab...........")
  try {
    const { id,roundName } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid ID format' });
    }

    const updatedCompany = await CompanyData.findOneAndUpdate(
      { _id: id, "assessmentRounds.name": roundName },
      { $set: { "assessmentRounds.$.lab": false } },
      { new: true }
    );
    

    console.log("Updated company:", updatedCompany);

    if (!updatedCompany) {
      return res.status(404).json({ message: 'Company not found' });
    }

    res.status(200).json({ message: 'Labs field updated successfully', data: updatedCompany });
  } catch (error) {
    res.status(500).json({ message: 'Error updating labs field', error: error.message });
  }
});




router.post("/applyCompany/:userId/:companyId", async (req, res) => {
  try {
    const { userId, companyId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(companyId)) {
      return res.status(400).json({ message: "Invalid User ID or Company ID" });
    }

    const user = await User.findById(userId);
    const comp = await CompanyData.findById(companyId);
    console.log(comp);

    if (!user || !comp) {
      return res.status(404).json({ message: "User or Company not found" });
    }

    if (!user.appliedCompanies) user.appliedCompanies = [];

    if (user.appliedCompanies.includes(companyId)) {
      return res.status(400).json({ message: "User already applied to this company" });
    }

    user.appliedCompanies.push(companyId);
    await user.save();

    if (!comp.applicants) comp.applicants = [];
    comp.applicants.push(user);

    await comp.save();

    return res.json({ message: "Company applied successfully" });
  } catch (error) {
    console.error("Error in applyCompany:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});


router.get("/scheduledInterviews/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const appliedCompanyIds = user.appliedCompanies.map(id => 
      typeof id === 'string' ? mongoose.Types.ObjectId(id) : id
    );

    const companies = await CompanyData.aggregate([
      {
        $match: { _id: { $in: appliedCompanyIds } }
      },
      {
        $project: {
          _id: 1,
          companyname: 1,
          interviewRounds: {
            $filter: {
              input: "$assessmentRounds",
              as: "round",
              cond: { 
                $and: [
                  { $ne: ["$$round.date", null] },
                  { $gt: ["$$round.date", new Date()] }
                ]
              }
            }
          }
        }
      }
    ]);

    const scheduledInterviews = companies.map(company => ({
      companyName: company.companyname,
      interviewRounds: company.interviewRounds ? company.interviewRounds.map(round => ({
        name: round.name,
        date: round.date
      })) : []
    })).filter(interview => interview.interviewRounds.length > 0);

    return res.json({ scheduledInterviews });
  } catch (error) {
    console.error("Error fetching scheduled interviews:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});


router.post("/add-interview", async (req, res) => {
  try {
    const {
      username,
      companyName,
      position,
      experience,
      interviewLevel,
      result,
    } = req.body;

    const newInterview = new Interview({
      username,
      companyName,
      position,
      experience,
      interviewLevel,
      result,
    });

    await newInterview.save();

    return res.json({ message: "Interview experience added successfully" });
  } catch (error) {
    console.error("Error adding interview experience:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});


  router.get("/remote-jobs", async (req, res) => {
    try {
      const response = await axios.get('https://serpapi.com/search?engine=google_jobs', {
        params: {
          engine: 'google_jobs',
          q: 'freshers entry level software engineer btech computer science',
          location: 'India',
          api_key: process.env.SERP_API_KEY,
          chips: 'date_posted:week,experience_level:ENTRY_LEVEL',
          hl: 'en',    
        }
      });
  
  
      const fresherKeywords = [
        'fresher',
        'entry level',
        'entry-level',
        'graduate',
        'new grad',
        'trainee',
        '0-1 year',
        '0-2 years',
        'btech',
        'b.tech',
        'computer science',
      ];
  
      const jobs = response.data?.jobs_results || [];
      
     
      const filteredJobs = jobs.filter(job => {
        const jobText = `${job.title} ${job.description}`.toLowerCase();
        return fresherKeywords.some(keyword => jobText.includes(keyword.toLowerCase()));
      }).slice(0, 30);
  
      res.json({ jobs: filteredJobs });
    } catch (error) {
      console.error('Error fetching jobs:', error);
      res.status(500).json({ message: 'Failed to fetch jobs' });
    }
  });

  router.get("/fetchinterviewexperience", async (req, res) => {
    try {
      const interviews = await Interview.find({});
      return res.json({ data: interviews });
    } catch (error) {
      console.error("Error fetching interview experiences:", error);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  });


router.get('/placementStatus/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Find the user by userId
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Get the placement status
    const status = user.placementStatus;

    if (status === 'Placed') {
      // If the status is placed, get the company name from the user document
      const companyName = user.companyPlaced;
      return res.json({ status, companyName });
    }

    return res.json({ status });
  } catch (error) {
    console.error('Error fetching placement status:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});


// In your backend user.js

router.post("/atsScore1", async (req, res) => {
  try {
    if (!req.files || !req.files.resume) {
      return res.status(400).json({ message: "No resume uploaded" });
    }

    const resumeFile = req.files.resume;
    const jobDescription = req.body.jobDescription;

    // Read resume text
    const resumeText = resumeFile.data.toString('utf8');
    console.log("Resume data : "+resumeText);

    // Define important categories of keywords
    const keywordCategories = {
      technicalSkills: [
        'SQL', 'Python', 'Java', 'software', 'engineering', 'developer', 'architecture',
        'ETL', 'data', 'algorithms', 'debugging', 'code', 'technical', 'design',
        'REST', 'API', 'database', 'development', 'programming'
      ],
      tools: [
        'Tableau', 'Power BI', 'OAC', 'SQL', 'PySpark', 'Business Intelligence'
      ],
      concepts: [
        'architecture', 'requirements', 'design', 'documentation', 'analysis',
        'quality', 'performance', 'implementation', 'enhancement'
      ],
      softSkills: [
        'collaboration', 'learning', 'development', 'teamwork', 'communication'
      ]
    };

    // Convert texts to lowercase for comparison
    const resumeLower = resumeText.toLowerCase();
    const jobDescLower = jobDescription.toLowerCase();

    // Calculate matches for each category
    let scores = {};
    let matches = [];
    let missing = [];

    Object.entries(keywordCategories).forEach(([category, keywords]) => {
      let categoryMatches = 0;
      let categoryMissing = [];

      keywords.forEach(keyword => {
        const keywordLower = keyword.toLowerCase();
        if (resumeLower.includes(keywordLower)) {
          categoryMatches++;
          matches.push(keyword);
        } else if (jobDescLower.includes(keywordLower)) {
          categoryMissing.push(keyword);
        }
      });

      scores[category] = (categoryMatches / keywords.length) * 100;
      missing = [...missing, ...categoryMissing];
    });

    // Calculate weighted score
    const weights = {
      technicalSkills: 0.4,
      tools: 0.2,
      concepts: 0.25,
      softSkills: 0.15
    };

    const finalScore = Object.entries(scores).reduce((total, [category, score]) => {
      return total + (score * weights[category]);
    }, 0);

    // Additional bonus points for education and experience
    let bonusPoints = 0;

    // Check for relevant education keywords
    if (resumeLower.includes('computer science') || 
        resumeLower.includes('information technology') ||
        resumeLower.includes('engineering')) {
      bonusPoints += 10;
    }

    // Check for relevant experience
    if (resumeLower.includes('internship') || 
        resumeLower.includes('project') ||
        resumeLower.includes('experience')) {
      bonusPoints += 10;
    }

    // Final score with bonus
    const totalScore = Math.min(100, finalScore + bonusPoints);

    // Detailed analysis
    const analysis = {
      score: Math.round(totalScore),
      categoryScores: scores,
      matches: [...new Set(matches)],
      missingKeywords: [...new Set(missing)].slice(0, 5),
      details: {
        technicalMatch: Math.round(scores.technicalSkills),
        toolsMatch: Math.round(scores.tools),
        conceptsMatch: Math.round(scores.concepts),
        softSkillsMatch: Math.round(scores.softSkills)
      }
    };

    res.json(analysis);

  } catch (error) {
    console.error("Error analyzing resume:", error);
    res.status(500).json({ 
      message: "Error analyzing resume",
      error: error.message 
    });
  }
});


// router.post("/atsScore", async (req, res) => {
//   try {
//     if (!req.files || !req.files.resume) {
//       return res.status(400).json({ message: "No resume uploaded" });
//     }

//     const resumeFile = req.files.resume;
//     const jobDescription = req.body.jobDescription;

//     // Validate file size (2MB limit)
//     if (resumeFile.size > 2 * 1024 * 1024) {
//       return res.status(400).json({ message: "File size should be less than 2MB" });
//     }

//     // Validate file type
//     const validTypes = [
//       'application/pdf',
//       'text/plain',
//       'application/msword',
//       'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
//     ];
    
//     if (!validTypes.includes(resumeFile.mimetype)) {
//       return res.status(400).json({ message: "Please upload a PDF, DOC, DOCX, or TXT file" });
//     }

//     try {
//       // Parse the resume
//       const resumeText = await parseResume(resumeFile);
      
//       // Calculate ATS score
//       const analysis = await calculateATSScore(resumeText, jobDescription);

//       res.json(analysis);
//     } catch (error) {
//       console.error("Error processing resume:", error);
//       res.status(500).json({ 
//         message: "Error processing resume",
//         error: error.message 
//       });
//     }

//   } catch (error) {
//     console.error("Error analyzing resume:", error);
//     res.status(500).json({ 
//       message: "Error analyzing resume",
//       error: error.message 
//     });
//   }
// });

export default router;

//---------------------------------------------ADMIN ENDPOINTS--------------------------------------------------//




router.get('/download-shortlist', async (req, res) => {
  const { companyName, tenthPercentage, twelfthPercentage, graduationCGPA ,pass, eligibilityCriteria} = req.query;

  try {
    if (!companyName || !tenthPercentage || !twelfthPercentage || !graduationCGPA || !pass || !eligibilityCriteria) {
      return res.status(400).json({ message: 'All parameters (companyName, tenthPercentage, twelfthPercentage, graduationCGPA) are required' });
    }

    const tenthPercent = parseFloat(tenthPercentage);
    const twelfthPercent = parseFloat(twelfthPercentage);
    const graduationCGPAValue = parseFloat(graduationCGPA);

    const shortlistedStudents = await User.find({
      isAdmin: {$eq : null},
      tenthPercentage: { $gte: tenthPercent },
      twelfthPercentage: { $gte: twelfthPercent },
      graduationCGPA: { $gte: graduationCGPAValue },
      pass: {$eq: pass},
      stream: { $in: eligibilityCriteria }
    });

    console.log(pass);

    if (shortlistedStudents.length === 0) {
      return res.status(404).json({ message: 'No eligible students found' });
    }

    

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(`${companyName} Shortlist`);

    
    worksheet.columns = [
      { header: 'Roll No', key: 'rollNo', width: 30 },
      { header: 'Student Name', key: 'name', width: 30 },
      { header: 'Stream', key: 'stream', width: 30 },
    ];

    
    shortlistedStudents.forEach(student => {
      worksheet.addRow({
        name: student.name,
        rollNo: student.rollNo, 
        companyPlaced: student.companyPlaced,
        tenthPercentage: student.tenthPercentage,
        twelfthPercentage: student.twelfthPercentage,
        graduationCGPA: student.graduationCGPA,
        stream:student.stream
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${companyName}_shortlist.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
    
  } catch (error) {
    console.error('Error generating shortlist:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});




router.post("/add-companies", async (req, res) => {
console.log(req.body);

  const {
    companyname,
    jobprofile,
    jobdescription,
    website,
    ctc,
    doa,
    doi,
    eligibilityCriteria,
    tenthPercentage,
    twelfthPercentage,
    graduationCGPA,
    pass,
    loc,
    expire,
    assessmentRounds
  } = req.body;
  
  try {
    const newCompany = new Company({
      _id: new mongoose.Types.ObjectId(), 
      companyname,
      jobprofile,
      jobdescription,
      website,
      ctc,
      doa,
      doi,
      eligibilityCriteria,
      tenthPercentage,
      twelfthPercentage,
      graduationCGPA,
      pass,
      loc,
      expire,
      assessmentRounds
    });
  
    await newCompany.save();
  
    const eligibleStudents = await User.find({
      isAdmin: { $ne: "1" },
      tenthPercentage: { $gte: tenthPercentage },
      twelfthPercentage: { $gte: twelfthPercentage },
      graduationCGPA: { $gte: graduationCGPA },
      pass: { $eq: pass },
      stream: { $in: eligibilityCriteria }  
    });
  
    const Comp = new CompanyData({
      _id: newCompany._id, 
      companyname,
      jobprofile,
      jobdescription,
      website,
      ctc,
      doa,
      doi,
      eligibilityCriteria,
      tenthPercentage,
      twelfthPercentage,
      graduationCGPA,
      pass,
      loc,
      expire,
      eligible: eligibleStudents,
      applicants:[],
      assessmentRounds
    });
  
    await Comp.save();

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,  
      secure: true, 
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD 
      },
      debug: true 
    });
    
    transporter.verify(function (error, success) {
      if (error) {
        console.log("Transporter verification error:", error);
      } else {
        console.log("Server is ready to send emails");
      }
    });
    
    for (const student of eligibleStudents) {
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: student.email,
        subject: `New Job Opportunity from ${companyname}`,
        html: `
          <h2>Congratulations! You've been shortlisted!</h2>
          <p>Dear ${student.name},</p>
          <p>You have been shortlisted for a new job opportunity at ${companyname}.</p>
          <h3>Job Details:</h3>
          <ul>
            <li><strong>Job Profile:</strong> ${jobprofile}</li>
            <li><strong>CTC:</strong> ${ctc} LPA</li>
            <li><strong>Interview Date:</strong> ${doi}</li>
            <li><strong>Job Description:</strong> ${jobdescription}</li>
            <li><strong>Company Website:</strong> ${website}</li>
          </ul>
          <p>Please log in to your Placify account dashboard to apply for this position.</p>
          <p><strong>Note:</strong> This opportunity is available based on your academic credentials meeting the company's criteria.</p>
          <p>Best regards,<br>Campus Recruitment Team</p>
        `
      };

      


      try {
        await transporter.sendMail(mailOptions);
      } catch (error) {
        console.error(`Failed to send email to ${student.email}:`, error);
      }
    }

    const accountSid = process.env.TWILIO_SID; 
const authToken = process.env.TWILIO_AUTH_KEY; 
const client = twilio(accountSid, authToken);


const sendWhatsAppMessages = async () => {
    for (const student of eligibleStudents) {
        try {
            const message = await client.messages.create({
                from: 'whatsapp:+14155238886', 
                to: `whatsapp:+91${student.contactNumber}`, 
                body: `Hello ${student.name},\n\nYou have been shortlisted for a new job opportunity at ${companyname}.\n\nPlease log in to your Placify account to apply for this position.`
            });

            console.log(`Message sent to ${student.name} (${student.contactNumber}): ${message.sid}`);
        } catch (error) {
            console.error(`Failed to send message to ${student.name}:`, error);
        }
    }
};

sendWhatsAppMessages();

    return res.json({ 
      message: "Company Registered and Notifications Sent",
      notifiedStudents: eligibleStudents.length 
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

router.get("/Applicants/:companyId", async (req, res) => {
  try {
    const { companyId } = req.params;
    console.log(companyId)

    if (!mongoose.Types.ObjectId.isValid(companyId)) {
      return res.status(400).json({ message: "Invalid company ID" });
    }

    const appliedStudents = await User.find({ appliedCompanies: companyId });
    const appliedStudentIds = new Set(appliedStudents.map(student => student._id.toString()));
   
    const companyData = await CompanyData.findById(companyId);
    console.log(companyData);
    if (!companyData) {
      return res.status(404).json({ message: "Company data not found" });
    }

    const notAppliedStudents = companyData.eligible
      .filter(student => !appliedStudentIds.has(student._id.toString()))
      .map(student => ({ rollNo: student.rollNo, name: student.name }));

    res.status(200).json({ applied: appliedStudents, notApplied: notAppliedStudents });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/companies", async (req, res) => {
  try {
    const companies = await CompanyData.find({});
    res.status(200).json(companies);
  } catch (error) {
    console.error("Error fetching companies:", error);
    res.status(500).json({ message: "Server error. Unable to fetch companies." });
  }
});

router.get('/track/companies/:applicantId', async (req, res) => {
  try {
    const { applicantId } = req.params;
    console.log(applicantId);
    const companies = await CompanyData.find({
      "applicants._id": new mongoose.Types.ObjectId(applicantId)
    });

    if (companies.length === 0) {
      return res.status(404).json({ message: "No companies found for the given applicant ID" });
    }

    res.status(200).json(companies);
  } catch (error) {
    console.error("Error fetching company data:", error);
    res.status(500).json({ message: "Error fetching company data", error });
  }
});



router.get("/jobs/eligible", verifyUser, async (req, res) => {
  try {
    const token = req.cookies.token;
    const decoded = jwt.verify(token, process.env.KEY);
    const userId = decoded._id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const eligibleCompanies = await Company.find({
      tenthPercentage: { $lte: user.tenthPercentage },
      twelfthPercentage: { $lte: user.twelfthPercentage },
      graduationCGPA: { $lte: user.graduationCGPA },
      eligibilityCriteria: { $in: [user.stream] },
      pass:user.pass,
      _id: { $nin: user.appliedCompanies } 
    });

    return res.json(eligibleCompanies);
  } catch (error) {
    console.error('Error fetching eligible jobs:', error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

router.get('/list/:passoutYear', async (req, res) => {
  try {
    const passoutYear = req.params.passoutYear;

    const result = await CompanyData.aggregate([
      { $match: { pass: passoutYear } },
      {
        $project: {
          companyName: "$companyname",
          lastAssessmentRound: { $arrayElemAt: ["$assessmentRounds", -1] }, 
          ctc: "$ctc",
          _id: 0
        }
      },
      {
        $project: {
          companyName: 1,
          finalSelectCount: {
            $size: { $ifNull: ["$lastAssessmentRound.selects", []] } 
          },
          ctc: 1
        }
      },
      { $sort: { finalSelectCount: -1 } }
    ]);

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: "Internal Server Error" });
  }
});



router.get("/getUsers", async (req, res) => {
  try {
    const allUsers = await User.find({isAdmin : null});
    console.log(allUsers);
    res.send({ data: allUsers });
  } catch (error) {
    console.log(error);
  }
});


router.get("/getCompanies", async (req, res) => {
  try {
    const allCompanies = await Company.find({});
    res.send({ data: allCompanies });
  } catch (error) {
    console.log(error);
  }
});


router.put("/updatecompany/:id", (req, res) => {
  const id = req.params.id;
  Company.findByIdAndUpdate(id, {
    companyname: req.body.companyname,
    jobprofile: req.body.jobprofile,
    ctc: req.body.ctc,
    doi: req.body.doi,
    tenthPercentage: req.body.tenthPercentage,
    twelfthPercentage: req.body.twelfthPercentage,
    graduationCGPA: req.body.graduationCGPA,
  })
    .then((company) => res.json(company))
    .catch((err) => res.json(err));
});

// Route to delete company data.
// It deletes the company based on the provided ID.
router.delete("/deletecompany/:id", (req, res) => {
  const id = req.params.id;
  Company.findByIdAndDelete({ _id: id })
    .then((response) => res.json(response))
    .catch((err) => res.json(err));
});

// Route to fetch a specific company by ID.
// It retrieves the company details based on the provided ID.
router.get("/getCompanies/:id", async (req, res) => {
  const id = req.params.id;
  try {
    const company = await Company.findById(id);

    res.send({ data: company });
  } catch (error) {
    console.log(error);
  }
});

//This API fetches the users and the companies they have applied to
router.get("/companyApplicants", async (req, res) => {
  try {
    const companies = await Company.find(); 

    const companyData = [];

    for (const company of companies) {
      const applicants = await User.find({ appliedCompanies: company._id });

      const companyInfo = {
        companyId: company._id,
        companyName: company.companyname,
        applicants: applicants.map((applicant) => ({
          userId: applicant._id,
          name: applicant.name,
          email: applicant.email,
        })),
      };
      
      companyData.push(companyInfo);
      
    }
    console.log("company applicant data  : "+companyData)
    res.json(companyData);
  } catch (error) {
    console.error("Error fetching company applicants:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.get("/students", async (req, res) => {
  try {
    var count = await User.countDocuments({ placementStatus: "Placed" });
    console.log("Placed students count: " + count);
    var total = await User.countDocuments({ isAdmin: null });
    console.log("total students count: "+total);
    var companyCount=await CompanyData.countDocuments({});
    res.json({ placedCount: count, totalCount : total,companiesCount:companyCount});
  } catch (error) {
    console.log("Error occurred while fetching placed students count:", error);
    res.status(500).json({ message: "An error occurred while fetching the count" });
  }
});

router.post("/updateShortlisting/:id/:activity/:rollNumbers", async (req, res) => {
  try {
    const { id, activity, rollNumbers } = req.params;


    if (!id || !rollNumbers || !activity) {
      return res.status(400).json({ message: "Invalid request data" });
    }

    const studentIdArray = rollNumbers.split(",");
    const company = await CompanyData.findOne({ _id: id });

    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    const roundIndex = company.assessmentRounds.findIndex(round => round.name === activity);

    if (roundIndex === -1) {
      return res.status(404).json({ message: "Assessment round not found" });
    }

    if (!company.assessmentRounds[roundIndex].selects) {
      company.assessmentRounds[roundIndex].selects = [];
    }

    company.assessmentRounds[roundIndex].selects = [
      ...new Set([...company.assessmentRounds[roundIndex].selects, ...studentIdArray])
    ];

    await company.save();

    res.status(200).json({ message: `${activity} shortlisting updated successfully!` });
  } catch (error) {
    console.log("api end pioint erorr.............")
    res.status(500).json({ message: "Internal Server Error" });
  }
});




// Backend API to update placementStatus
router.post("/updatePlacementStatus", async (req, res) => {
  try {
    const { userIds, companyId, status } = req.body;

    console.log(userIds)

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ message: "Invalid or empty userIds array." });
    }

    const company = await CompanyData.findById(companyId);
    if (!company) {
      return res.status(404).json({ message: "Company not found." });
    }

    const users = await User.find({ rollNo: { $in: userIds } });

    if (users.length === 0) {
      return res.status(404).json({ message: "No users found." });
    }

    const updatePromises = users.map((user) => {
      user.placementStatus = status;
      user.companyPlaced = company.companyname;
      return user.save();
    });

    await Promise.all(updatePromises);

    res.json({
      message: `${users.length} users' placement status updated to ${status} successfully.`,
    });
  } catch (error) {
    console.error("Error updating placement status:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.post("/updateAssessmentStatus", async (req, res) => {
  try {
    const { userId, companyId, status } = req.body;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const company = await Company.findById(companyId);
    console.log(company.companyname);
    if (!company) {
      return res.status(404).json({ message: "Company not found." });
    }
    user.placementStatus = status;
    user.companyPlaced = company.companyname;
    await user.save();
    res.json({
      message: `Placement status updated to ${status} successfully.`,
    });
  } catch (error) {
    console.error("Error updating placement status:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

export { router as UserRouter };