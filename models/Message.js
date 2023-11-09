// Mongodb et Mongoose :
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  date: { type: String, required: true },
  expediteur: { type: String, required: true},
  destinataire: { type: String, required: true },
  texte: { type: String, required: true },
  lu: { type: Boolean},
});

module.exports = mongoose.model('Message', messageSchema);