// Mongodb et Mongoose :
const mongoose = require('mongoose');

const produitSchema = new mongoose.Schema({
  categorie: { type: String,required: true },
  nom: { type: String,required: true},
  prix: { type: Number,required: true },
  description: { type: String,required: true },
  photo: { type: String,required: true }
});

module.exports = mongoose.model('Produit', produitSchema);