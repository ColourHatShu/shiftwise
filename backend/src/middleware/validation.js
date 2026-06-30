/**
 * Input Validation Middleware using Joi
 * 
 * Provides validation schemas for document-related operations.
 * 
 * @module middleware/validation
 */

const Joi = require('joi');

// ─── Document Upload Validation Schema ───────────────────────────────────────
const documentUploadSchema = Joi.object({
    workerId: Joi.string().required().messages({
        'string.empty': 'Worker ID is required',
        'any.required': 'Worker ID is required'
    }),
    documentTypeId: Joi.string().required().messages({
        'string.empty': 'Document Type ID is required',
        'any.required': 'Document Type ID is required'
    }),
    notes: Joi.string().max(1000).allow('').optional().messages({
        'string.max': 'Notes cannot exceed 1000 characters'
    })
});

// ─── Document Verification Validation Schema ─────────────────────────────────
const documentVerifySchema = Joi.object({
    status: Joi.string().valid('APPROVED', 'REJECTED').required().messages({
        'any.only': 'Status must be either APPROVED or REJECTED',
        'any.required': 'Status is required'
    }),
    notes: Joi.string().max(2000).allow('').optional().messages({
        'string.max': 'Notes cannot exceed 2000 characters'
    }),
    manualExpiryDate: Joi.date().iso().optional().messages({
        'date.format': 'Manual expiry date must be a valid ISO date'
    }),
    version: Joi.string().optional().messages({
        'string.base': 'Version must be a timestamp string'
    })
});

// ─── Validation Middleware Factory ───────────────────────────────────────────
const validate = (schema) => {
    return (req, res, next) => {
        const { error, value } = schema.validate(req.body, {
            abortEarly: false, // Return all validation errors
            stripUnknown: true // Remove unknown fields
        });

        if (error) {
            const errorMessages = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message
            }));

            return res.status(400).json({
                error: 'Validation failed',
                details: errorMessages
            });
        }

        // Replace req.body with validated/sanitized value
        req.body = value;
        next();
    };
};

module.exports = {
    validate,
    documentUploadSchema,
    documentVerifySchema
};
