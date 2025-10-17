const Joi = require('joi');
const validate = require('./validate');

const propertySchema = Joi.object({
  address: Joi.string().required(),
  type: Joi.string().required(),
  rent: Joi.number().positive().required(),
  status: Joi.string().valid('Vacant', 'Occupied').optional()
});

const assignSchema = Joi.object({
  tenantEmail: Joi.string().email().required()
});

module.exports = {
  validateCreateProperty: validate(propertySchema),
  validateAssignTenant: validate(assignSchema)
};
