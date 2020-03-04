const productModel = require('./product-model');
const cartModel = require('./cart-model');
const mongoose = require('mongoose');


async function updateProductsAssociatedToCart(updatedCart, isCreate) {
    let currCart, newProducts = [], notUpdated = [], productNotFound = [];
    let successes = [], errors = {};
    if (!isCreate) {
        currCart = await cartModel.findById(mongoose.Types.ObjectId(updatedCart._id));
        currCart = currCart._doc;
    } else {
        currCart = {
            cartItems: []
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
                } else {
                    count++;
                    notUpdated.push(currItem);
                    if (count === updatedCart.cartItems.length) {
                        resolve(true);
                    }
                }
            } else {
                newProducts.push(updatedItem);
                count++;
                    if (count === updatedCart.cartItems.length) {
                        resolve(true);
                    }
            }
        });
    });

    const newProductsUpdated = await handleNewProducts(newProducts, currCart,updatedCart, notUpdated, productNotFound);
    const deletedRemaining = await handleDeletedProducts(currCart);
    if (allItemsParsed && newProductsUpdated && deletedRemaining) {//will always be true,will be executed after all items parsed
        return {
            successes,
            errors,
            notUpdated,
            updatedCart
        };
    }
}

function handleDeletedProducts(currCart){
    return new Promise((resolve, reject) => {
        const deleted = currCart.cartItems.filter(p => !p.touched);
        let count = 0;
        if(!deleted.length){
            resolve(true)
        }
        deleted.forEach(p => {
            let id = null;
            if(typeof(p.productId) ==="string"){
                id = mongoose.Types.ObjectId(p.productId)
            }else{
                id = p.productId;
            }
            productModel.findOne({ _id: id }).then(pDoc => {
                let doc = pDoc._doc;
                doc.stockQuantity+=(p.quantity ||0);
                productModel.updateOne({_id:doc._id},doc).then(r=>{
                    count++;
                    if(count===deleted.length){
                        resolve(true);
                    }
                });
            });
        });
    });
}



function handleNewProducts(newProducts, currCart,updatedCart, notUpdated, productNotFound){
    return new Promise((resolve, reject) => {
        let counter = 0;
        if(!newProducts.length){
            resolve(true);
        }
        newProducts.forEach(product => {
            const product0 = {
                quantity: 0,
                _id: product._id
            }
            updateProduct(product0, product)
                .then(r => {
                    
                    if (!updatedCart.cartItems.find(e => e.productId.toString() === product.productId.toString())) {
                        updatedCart.cartItems.push({
                            productId: product.productId,
                            quantity: product.quantity
                        })
                    }
                    counter++;
                    if(counter ===newProducts.length){
                        resolve(true)
                    }

                }).catch(err => {
                    if(err==='mongo_error'){
                        productNotFound.push(product);
                        
                    }
                    const index = updatedCart.cartItems.findIndex(e => e.productId.toString() === (product.productId || product._id).toString());
                    if (index !== -1) {
                        updatedCart.cartItems.splice(index, 1);
                    }
                    counter++;
                    if(counter ===newProducts.length){
                        resolve(true)
                    }
                })
        });
    });
}


function makeProductIdsAsObjectId(body) {
    body.cartItems.forEach(product => {
        product.productId = mongoose.Types.ObjectId(product.productId)
    })
}




function updateProduct(currItem, updatedItem) {
    return new Promise((resolve, reject) => {
        let canBeUpdated = false;
        let productId = null;
        if(typeof(updatedItem.productId)==='string' ){
            productId = mongoose.Types.ObjectId(updatedItem.productId)
        }else{
            productId = updatedItem.productId
        }
        productModel.findById(productId).then(productM => {
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
                    .then(result => {
                        resolve('success');

                    })
                    .catch(err => { debugger; reject('mongo_error') });
            } else {
                reject('cannot_be_updated');
            }
        }).catch(err => {
            console.log('err');
            reject('mongo_error')
        });
    });
}


module.exports = {
    updateProductsAssociatedToCart,
    makeProductIdsAsObjectId
}