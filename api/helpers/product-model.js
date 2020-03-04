const mongoose= require('mongoose');
const Schema = mongoose.Schema;
// const idGenerator = require("./idGenerator");


var productSchema = new Schema({
    name:{
        type:String,
        required:true
    },
    price:{
        type:Number,
        required:true
    },
    stockQuantity:{
        type:Number,
        required:true
    }
})

productSchema.pre('save', (next)=>{
console.log('presave hook');
next();
});

module.exports = mongoose.model('Product', productSchema)