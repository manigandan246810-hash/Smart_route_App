import mongoose from 'mongoose';

const trafficEventSchema = new mongoose.Schema({
    _id: { type: String, required: true }, // custom ID like trf-1
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    severity: { type: String, default: 'Medium' },
    description: { type: String, default: '' },
    isSOSZone: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    timestamp: { type: String, default: () => new Date().toISOString() }
}, {
    timestamps: true,
    _id: false
});

export const TrafficEvent = mongoose.model('TrafficEvent', trafficEventSchema);
