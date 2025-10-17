const Joi = require('joi');
const validate = require('./validate');

const paymentSchema = Joi.object({
  tenant_id: Joi.number().integer().allow(null),
  property_id: Joi.number().integer().allow(null),
  amount: Joi.number().positive().required(),
  status: Joi.string().optional(),
  method: Joi.string().required(),
  date: Joi.string().allow(null, '').optional(),
  reference: Joi.string().allow(null, '').optional(),
  gateway_status: Joi.string().allow(null, '').optional()
});

const mobileSchema = Joi.object({
  tenant_id: Joi.number().integer().allow(null),
  property_id: Joi.number().integer().allow(null),
  amount: Joi.number().positive().required(),
  method: Joi.string().valid('MTN', 'Airtel').required(),
  phone: Joi.string().required()
});

module.exports = {
  validatePaymentCreate: validate(paymentSchema),
  validatePaymentUpdate: validate(paymentSchema),
  validateMobilePayment: validate(mobileSchema)
};
