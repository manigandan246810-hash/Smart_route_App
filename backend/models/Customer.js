import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema({
    _id: { type: String, required: true }, // custom ID like cust-1
    name: { type: String, required: true },
    address: { type: String, default: '' },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    priority: { type: String, default: 'Medium', enum: ['High', 'Medium', 'Low'] }
}, {
    timestamps: true,
    _id: false
});

export const Customer = mongoose.model('Customer', customerSchema);
