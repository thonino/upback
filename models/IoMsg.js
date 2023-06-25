// Mongodb et Mongoose :
const mongoose = require('mongoose');

const ioMsgSchema = new mongoose.Schema({
  texte: { type: String,required: true  },
});

module.exports = mongoose.model('IoMsg', ioMsgSchema);