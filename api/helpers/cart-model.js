const mongoose = require('mongoose');
const Schema = mongoose.Schema;


const cartSchema = new Schema({
    cartItems:[{productId:Schema.ObjectId,quantity:Number}]
})

module.exports = mongoose.model('Cart',cartSchema);

