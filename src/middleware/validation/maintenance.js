const Joi = require('joi');
const validate = require('./validate');

const baseSchema = Joi.object({
  tenant_id: Joi.number().integer().required(),
  property_id: Joi.number().integer().required(),
  issue: Joi.string().required(),
  priority: Joi.string().required(),
  status: Joi.string().optional(),
  date: Joi.string().required()
});

const statusSchema = Joi.object({
  status: Joi.string().required()
});

module.exports = {
  validateMaintenanceCreate: validate(baseSchema),
  validateMaintenanceUpdate: validate(baseSchema),
  validateStatusUpdate: validate(statusSchema)
};
