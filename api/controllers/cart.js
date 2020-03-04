const mongoose = require('mongoose');
const cartModel = require('../helpers/cart-model');
const utils = require('../helpers/utils');


function getCarts(req, res) {

}

function createCart(req, res) {
    utils.updateProductsAssociatedToCart(req.body, true)
        .then(messages => postProductUpdateCreateCart(req, res, messages));
}


function updateCart(req, res) {
    utils.updateProductsAssociatedToCart(req.body, false)
        .then(messages => postProductUpdate(req, res, messages));
}

var postProductUpdate = (req, res, messages) => {
    const bodyToPut = messages.updatedCart;
    
    const id = mongoose.Types.ObjectId(req.swagger.params.cartId.value);
    bodyToPut._id = id
    cartModel.updateOne({ _id: id }, req.body).then(result => {
        res.json({
            message: 'cart updated successfully',
            additional: messages
        });
    }).catch((err) => {
        res.status(400).json({
            message: 'error while updating cart'
        });
    });
}

var postProductUpdateCreateCart = (req, res, messages) => {
    // utils.makeProductIdsAsObjectId(req.body);

    const bodyToPost = messages.updatedCart;
    // bodyToPost._id = req.body._id;
    cartModel.create(bodyToPost).then(result => {
        res.json({
            message: 'cart created successfully'
        })
    }).catch((err) => {
        res.status(400).json({
            message: 'error while creating cart'
        })
    });
}


module.exports = {
    createCart,
    updateCart
}