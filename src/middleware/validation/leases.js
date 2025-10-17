const Joi = require('joi');
const validate = require('./validate');

const sendSchema = Joi.object({
  propertyId: Joi.number().integer().required(),
  tenantId: Joi.number().integer().required()
});

module.exports = {
  validateSendLease: validate(sendSchema)
};
