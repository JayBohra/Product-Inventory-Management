var mongoose = require('mongoose');
const ProductModel = require('../helpers/product-model');

function createProduct(req,res){
    console.log(req.body);
    
    ProductModel.create(req.body).then(result => {
        console.log("Result", result);
        res.json({
            message:'success in creating'
        })
    }).catch(err => {
        console.log(err);
        
    });
}

function updateProduct(req,res){
    console.log(req);
    debugger;
    const id = mongoose.Types.ObjectId(req.swagger.params.productId.value);

    ProductModel.updateOne({_id:id},req.body).then(result => {
        console.log("Result", result);
        res.json({
            message:'success in updating'
        })
    }).catch(err => {
        res.json({
            message:'error in updating'
        });
    });
}


module.exports = {
    createProduct: createProduct,
    updateProduct:updateProduct
}



