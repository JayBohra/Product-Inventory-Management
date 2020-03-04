const mongoose = require('mongoose');
const cartModel = require('../helpers/cart-model');


function getCarts(req, res){

}

function makeProductIdsAsObjectId(body){
    body.cartItems.forEach(product=>{
        product.productId = mongoose.Types.ObjectId(product.productId)
    })
}

function createCart(req, res){
    
    
    updateProductsAssociatedToCart(req.body,true);

    makeProductIdsAsObjectId(req.body);
    cartModel.create(req.body).then(result => {
        res.json({
            message: 'cart created successfully'
        })
    }).catch((err) => {
        res.json({
            message: 'error while creating cart'
        })
    });
}

function updateCart(req, res){
    updateProductsAssociatedToCart(req.body,false);
    const id = mongoose.Types.ObjectId(req.swagger.params.cartId.value)
    cartModel.updateOne({_id:id},req.body).then(result => {
        res.json({
            message: 'cart updated successfully'
        })
    }).catch((err) => {
        res.json({
            message: 'error while updating cart'
        })
    });
}


module.exports = {
    createCart,
    updateCart
}