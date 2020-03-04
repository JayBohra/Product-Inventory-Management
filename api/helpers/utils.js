const productModel = require('./product-model');
const cartModel = require('./cart-model');
const mongoose = require('mongoose');


async function updateProductsAssociatedToCart(updatedCart, isCreate) {
    let currCart, newProducts = [],notUpdated = [];
    let successes = [], errors = {};
if(!isCreate){
    currCart = await cartModel.findById(mongoose.Types.ObjectId(updatedCart._id));
    currCart = currCart._doc;
}else{
currCart = {
    cartItems:[]
}
}
    
    // cartModel.model.findOne({_id:mongoose.Types.ObjectId(updatedCart._id)}).then(e=>{debugger;console.log('s',e)}).catch(e=>console.log('e',e))
    // cartModel.findOne({_id:mongoose.Types.ObjectId(updatedCart._id)}).exec().then(e=>{debugger;console.log('s',e)}).catch(e=>console.log('e',e))
    // cartModel.findOne(mongoose.Types.ObjectId(updatedCart._id)).then(e=>{console.log('so',e)}).catch(e=>console.log('eo',e))


    const allItemsParsed = await new Promise((resolve, reject) => {
        let count = 0;
        updatedCart.cartItems.forEach((updatedItem) => {
            const currItem = currCart.cartItems.find(item => item.productId.toString() === updatedItem.productId);
            updatedItem.touched = true;
            if (currItem) {
                currItem.touched = true;
                if (currItem.quantity !== updatedItem.quantity) {
                    updateProduct(currItem, updatedItem)
                        .then(result => {
                            successes.push(currItem._id.toString());
                            count++;
                            if (count === updatedCart.cartItems.length) {
                                resolve(true);
                            }

                        })
                        .catch(err => {
                            if (errors[err]) {
                                errors[err].push(currItem._id.toString());
                            } else {
                                errors[err] = [currItem._id.toString()];
                            }
                            count++;
                            if (count === updatedCart.cartItems.length) {
                                resolve(true);
                            }
                        });
                }else {
                    count++;
                    notUpdated.push(currItem);
                    if(count === updatedCart.cartItems.length){
                        resolve(true);
                    }
                }
            } else {
                newProducts.push(updatedItem);
            }
        });
    });
    

    if (allItemsParsed) {//will always be true,will be executed after all items parsed
        if(notUpdated.length === updatedCart.cartItems.length){
            return {notUpdated:true}
        }
        return {
            successes,
            errors,
        };
    }
}

function makeProductIdsAsObjectId(body) {
    body.cartItems.forEach(product => {
        product.productId = mongoose.Types.ObjectId(product.productId)
    })
}




function updateProduct(currItem, updatedItem) {
    return new Promise((resolve, reject) => {
        let canBeUpdated = false;
        productModel.findById(currItem.productId).then(productM => {
            const product = productM._doc;
            if (currItem.quantity > updatedItem.quantity) {// some quantity released
                canBeUpdated = true
                product.stockQuantity += currItem.quantity - updatedItem.quantity;
            } else if (currItem.quantity < updatedItem.quantity) {
                const stockQuantityAfterUpdate = product.stockQuantity - (updatedItem.quantity - currItem.quantity);
                if (stockQuantityAfterUpdate >= 0) {
                    product.stockQuantity = stockQuantityAfterUpdate;
                    canBeUpdated = true
                }
            }

            if (canBeUpdated) {
                productModel.updateOne({ _id: product._id }, product)
                    .then(result => { debugger; resolve('success') })
                    .catch(err => { debugger; reject('mongo_error') });
            } else {
                reject('cannot_be_updated');
            }
        }).catch(err => reject('mongo_error'));
    });
}

module.exports = {
    updateProductsAssociatedToCart,
    makeProductIdsAsObjectId
}