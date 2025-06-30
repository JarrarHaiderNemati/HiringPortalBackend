const mongoose =require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    contact: {
      type: String,
      unique:true,
      sparse:true
    },
    address: {
      type: String,
    },
    discipline: {
      type: String,
      required: true
    },
    graduation: {
      type:Number,
      required:true
    },
    university: {
      type: String
    },
    progLanguages: {
      type: [String],
      default:[]
    },
    status:{
      type:String,
      enum: ['Recieved', 'Shortlisted'],
      default:'Recieved'
    },
    niche: {
      type: String,
      default:'',
      trim: true
    },
    file: {
      type: String,
      default:''
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("UserDetails", userSchema);
