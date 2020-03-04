const productModel = require('./product-model');
const cartModel = require('./cart-model');


async function updateProductsAssociatedToCart(updatedCart, isCreate) {
    let currCart;
    let successes =[],errors = {};

    try {
        currCart = await cartModel.findById(updatedCart._id);
    } catch (e) {
        return new Error('Error while fetching data');
    }

    const allItemsParsed = await new Promise((resolve,reject)=>{
        let count = 0;
        updatedCart.cartItems.forEach((updatedItem) => {
            const currItem = currCart.find(item => item.productId === upatedItem.productId);
            currItem.touched = true;
            updatedItem.touched = true;
            if (currItem.quantity !== updatedItem.quantity) {
                updateProduct(currItem, updatedItem)
                .then(result=>{
                     successes.push(product._id.toString());
                     count++;
                     if(count === updatedCart.cartItems.length){
                        resolve(true);
                     }

                })
                .catch(err=>{
                    if(errors[err]){
                        errors[err].push(product._id.toString());
                    }else {
                        errors[err] = [product._id.toString()];
                    }
                    count++;
                    if(count=== updatedCart.cartItems.length){
                        resolve(true);
                    }
                });
            }
        });
    });

    if(allItemsParsed){//will always be true,will be executed after all items parsed
        return {
            successes,
            errors
        };
    }
}




function updateProduct(currItem, updatedItem) {
    return new Promise((resolve, reject) => {
        let canBeUpdated = false;
        productModel.findById(currItem.productId).then(product => {
            if (currItem.quantity > updatedItem.quantity) {// some quantity released
                canBeUpdated = true
                product.stockQuantity += currItem.quantity - updatedItem.quantity;
            } else if (currItem.quantity < updatedItem.quantity) {
                const stockQuantityAfterUpdate = product.stockQuantity - (updatedItem.quantity - currItem.quantity);
                if(stockQuantityAfterUpdate >=0){
                    product.stockQuantity =stockQuantityAfterUpdate;
                    canBeUpdated = true
                }
            }

            if(canBeUpdated){
                productModel.updateOne({_id:product._id},product)
                .then(result=>resolve('success'))
                .catch(err=>reject('mongo_error'));
            }else{
                reject('cannot_be_updated');
            }
        }).catch(err=>reject('mongo_error'));
    });
}