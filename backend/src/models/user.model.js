import mongoose from "mongoose";


const userSchema = new mongoose.Schema({
    email : {
        type : String,
        required : true,
        unique : true
    },
    name: {
        type : String,
        required : true,
        unique : true
    },
    image: {
        type : String,
        unique : true
    },
    clerkId : {
        type : String,
        required : true,
        unique : true
    }
},{timestamps : true});

export const User = mongoose.model("User", userSchema);