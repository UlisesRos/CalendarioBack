const mongoose = require('mongoose')

const ModalSchema = new mongoose.Schema({
    title: String,
    subtitle: String,
    link: String,
    image: String,
    description: String
});

const ModalContent = mongoose.model('ModalContent', ModalSchema);

module.exports = ModalContent