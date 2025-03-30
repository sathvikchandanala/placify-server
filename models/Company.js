import mongoose from 'mongoose'
const CompanySchema = new mongoose.Schema({
    companyname: { type: String, required: true },
    jobprofile: { type: String, required: true},
    jobdescription: { type: String, required: true },
    website: { type: String, required: true},
    ctc: { type: Number, required: true },
    eligibilityCriteria: [{ type: String }],
    tenthPercentage: { type: Number, required: true },
    twelfthPercentage: { type: Number, required: true },
    interviewType:{type: String,require:true},
    graduationCGPA: { type: Number },
    loc:{type:String, default:null},
    pass : {type: String, required : true},
    expire: { type: Date, required: true },
    created:{ type: Date, default: Date.now },
    assessmentRounds: [
    {
        name: { type: String, required: true },
        date: { type: Date, required: true },
        lab: { type: Boolean, default : null },
    }
],

});

CompanySchema.index({ expire: 1 }, { expireAfterSeconds: 0 });

const CompanyModel = mongoose.model("Company", CompanySchema);
export {CompanyModel as Company}
