/**
 *	Author: JCloudYu
 *	Create: 2019/07/16
**/
import {HTTPRequestRejectError, SystemError} from "/kernel/error.esm.js";
import {BaseError} from "/lib/error/base-error.esm.js";

import * as VersionAPI from "./version.esm.js";



const APIHandlers = {
	version: VersionAPI
};



export async function Init() {
	const promises = [];
	for(const handler of Object.values(APIHandlers)) {
		if ( handler.Init ) {
			promises.push(handler.Init());
		}
	}
	await Promise.wait(promises);
}
export async function CleanUp() {
	const promises = [];
	for(const handler of Object.values(APIHandlers)) {
		if ( handler.CleanUp ) {
			promises.push(handler.CleanUp());
		}
	}
	await Promise.wait(promises);
}
export function CanHandleAPI(req, res) {
	const {endpoint:api} = req.info;

	// NOTE: Detect api handler
	const api_module = APIHandlers[api.substring(1).toLowerCase()];
	if ( !api_module ) {
		throw new HTTPRequestRejectError(BaseError.RESOURCE_NOT_FOUND);
	}
}
export function RequestPreprocessor(req, res) {}
export function Handle(req, res) {
	const {endpoint:api} = req.info;
	const api_module = APIHandlers[api.substring(1).toLowerCase()];
	return api_module.Handle(req, res);
}
export function HandleSystemError(req, res, error) {
	if ( error instanceof Error ) {
		if ( error instanceof SystemError ) {
			let error_detail = JSON.stringify(error, null, 4).replace(/\r\n/g, '\n').split('\n');
			error_detail = error_detail.map((item, idx)=>(idx===0?item:`${' '.repeat(4)}${item}`)).join('\n');
		
			let error_stack = error.stack.trim().replace(/\r/g, '\n').split('\n');
			error_stack = error_stack.map((item, idx)=>(idx===0?'':`${' '.repeat(8)}${item.trim().substring(3)}`)).join('\n');
			
			logger.error(
				'Unexpected system error has occurred!\n' +
				`    Error: ${error.message}\n` +
				`    Detail: ${error_detail}\n` +
				`    Stack: {${error_stack}\n${' '.repeat(4)}}`
			);
		
			error = new HTTPRequestRejectError(BaseError.UNEXPECTED_SERVER_ERROR);
		}
		else
		if ( !(error instanceof HTTPRequestRejectError) ) {
			let error_stack = error.stack.trim().replace(/\r/g, '\n').split('\n');
			error_stack = error_stack.map((item, idx)=>(idx===0?'':`${' '.repeat(8)}${item.trim().substring(3)}`)).join('\n');
		
			logger.error(
				`Unhandled rejection is received!\n` +
				`    Error: ${error.message}\n` +
				`    Stack: {${error_stack}\n${' '.repeat(4)}}`
			);
			
			error = new HTTPRequestRejectError(BaseError.UNEXPECTED_SERVER_ERROR, {
				message: error.message,
				stack: error.stack.split('\n')
			});
		}
	}
	else {
		logger.error( `Unknown error is received!`, error );
		error = new HTTPRequestRejectError(BaseError.UNEXPECTED_SERVER_ERROR, error);
	}
	
	
	
	if ( res.writableFinished||res.finished ) return;
	
	const headers = Object.assign({}, error.headers||{}, {"Content-Type":"application/json"});
	res.writeHead(error.httpStatus, headers);
	res.end(JSON.stringify(error));
}
