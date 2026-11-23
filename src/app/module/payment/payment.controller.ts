import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { PaymentServices } from "./payment.service";

const createCheckout = catchAsync(async (req: Request, res: Response) => {
	const { reused, payment } = await PaymentServices.createCheckout(req.user!, req.validated!.body);
	sendResponse(res, {
		statusCode: reused ? httpStatus.OK : httpStatus.CREATED,
		success: true,
		message: reused ? "Checkout Session Already Open" : "Checkout Session Created",
		data: {
			paymentId: payment.id,
			amount: payment.amount,
			currency: payment.currency,
			status: payment.status,
			checkoutUrl: payment.checkoutUrl,
			expiresAt: new Date(payment.createdAt.getTime() + 31 * 60 * 1000),
		},
	});
});

const handleWebhook = catchAsync(async (req: Request, res: Response) => {
	const result = await PaymentServices.handleWebhook(req.body, req.headers["stripe-signature"] as string | undefined);
	sendResponse(res, { statusCode: httpStatus.OK, success: true, message: "Webhook Received", data: result });
});

const getCheckoutResult = catchAsync(async (req: Request, res: Response) => {
	const result = await PaymentServices.getCheckoutResult(req.validated!.query.session_id);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: result.status === "PAID" ? "Payment Successful" : "Payment Received, Confirmation In Progress",
		data: result,
	});
});

const cancelCheckout = catchAsync(async (req: Request, res: Response) => {
	const result = await PaymentServices.cancelCheckout(req.validated!.query.session_id);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: result.status === "CANCELLED" ? "Payment Cancelled" : `Payment Is ${result.status}`,
		data: result,
	});
});

const getPayments = catchAsync(async (req: Request, res: Response) => {
	const { data, meta } = await PaymentServices.getPayments(req.user!, req.validated!.query);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Payments Retrieved Successfully",
		data,
		meta,
	});
});

const getPaymentById = catchAsync(async (req: Request, res: Response) => {
	const result = await PaymentServices.getPaymentById(req.user!, req.validated!.params.paymentId);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Payment Retrieved Successfully",
		data: result,
	});
});

export const PaymentController = {
	createCheckout,
	handleWebhook,
	getCheckoutResult,
	cancelCheckout,
	getPayments,
	getPaymentById,
};
