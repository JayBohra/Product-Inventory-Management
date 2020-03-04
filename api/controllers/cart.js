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
    if(messages.notUpdated){
        res.json({
            message: 'nothing updated'
        });
        return;
    }
    const id = mongoose.Types.ObjectId(req.swagger.params.cartId.value);
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
    cartModel.create(req.body).then(result => {
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