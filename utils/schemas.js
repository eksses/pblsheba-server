const { z } = require('zod');

const loginSchema = z.object({
  phone: z.string().min(11, 'Phone number must be at least 11 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const registerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  fatherName: z.string().min(1, "Father's name is required"),
  dob: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid date format for Date of Birth",
  }),
  phone: z.string().min(11, 'Phone number must be at least 11 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  nid: z.string().optional(),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  address: z.string().optional(),
});

const surveySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  fathersName: z.string().min(1, "Father's name is required"),
  wardNo: z.string().min(1, 'Ward No is required'),
  phone: z.string().min(11, 'Phone number must be at least 11 characters'),
  familyMembers: z.number().int().positive().optional(),
  monthlyIncome: z.number().nonnegative().optional(),
});

module.exports = {
  loginSchema,
  registerSchema,
  surveySchema,
};
