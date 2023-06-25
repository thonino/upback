// Mongodb et Mongoose :
const mongoose = require('mongoose');
const userSchema = new mongoose.Schema({
    prenom: { type: String, required: true},
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, required: true }
});
module.exports = mongoose.model('User', userSchema);
