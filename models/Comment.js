const mongoose = require('mongoose');
const {Schema,model} = mongoose;

const CommentSchema =  new Schema({
    message : String,
    createdAt : Date,
    author:{type:Schema.Types.ObjectId, ref:'User'},
    post:{type:Schema.Types.ObjectId, ref:'Post'},
});

const CommentModel = model('Comment', CommentSchema);

module.exports = CommentModel;