const Joi = require('joi');
const validate = require('./validate');

const tenantSchema = Joi.object({
  name: Joi.string().min(1).required(),
  email: Joi.string().email().required(),
  phone: Joi.string().allow(null, '').optional(),
  property_id: Joi.number().integer().allow(null).optional(),
  balance: Joi.number().optional(),
  last_payment: Joi.date().allow(null).optional()
});

module.exports = {
  validateCreateTenant: validate(tenantSchema),
  validateUpdateTenant: validate(tenantSchema)
};
