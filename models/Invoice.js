// Mongodb et Mongoose :
const mongoose = require('mongoose');
const invoiceSchema = new mongoose.Schema({
  basketId: { type: String,required: true  },
  date: { type: String,required: true  }
});
module.exports = mongoose.model('Invoice', invoiceSchema);