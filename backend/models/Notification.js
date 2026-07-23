import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
    _id: { type: String, required: true }, // custom ID like not-1
    title: { type: String, required: true },
    message: { type: String, required: true },
    timestamp: { type: String, default: () => new Date().toISOString() },
    read: { type: Boolean, default: false },
    type: { type: String, default: 'System' },
    driverId: { type: String, default: null },
    tripId: { type: String, default: null },
    orderId: { type: String, default: null }
}, {
    timestamps: true,
    _id: false
});

export const Notification = mongoose.model('Notification', notificationSchema);
