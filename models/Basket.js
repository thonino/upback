// Mongodb et Mongoose :
const mongoose = require('mongoose');

const basketSchema = new mongoose.Schema({
  date: { type: String, required: true },
  email: { type: String, required: true },
  produits: {type: Array},
  prix_total: { type: Number, required: true }
});

module.exports = mongoose.model('Basket', basketSchema);


