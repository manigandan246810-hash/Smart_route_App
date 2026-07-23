import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    _id: { type: String, required: true }, // custom ID like usr-1, usr-2
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, required: true, enum: ['admin', 'driver'] }
}, {
    timestamps: true,
    _id: false // Disable auto-generated ObjectId for _id since we specify string _id
});

export const User = mongoose.model('User', userSchema);
