// Mongodb et Mongoose :
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  date: { type: String },
  expediteur: { type: String},
  destinataire: { type: String },
  texte: { type: String },
  lu: { type: Boolean },
});

module.exports = mongoose.model('Message', messageSchema);