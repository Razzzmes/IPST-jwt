const UserModel = require('../models/user-model');
const bcrypt = require('bcrypt');
const uuid = require('uuid');
const mailService = require('./mail-service');
const tokenService = require('./token-service');
const UserDto = require('../dtos/user-dto');
const ApiError = require('../exceptions/api-error');

class UserService{
	async registration(name, surname, middlename, email, username, password){
		const candidate = await UserModel.findOne({email});

		if(candidate) {
			throw ApiError.BadRequest(`Пользователь с почтовым адресом ${email} уже существует`)
		}

		const hashPassword = await bcrypt.hash(password, 3);
		const activationLink = uuid.v4();

		const user = await UserModel.create({name, surname, middlename, email, username, password: hashPassword, activationLink});
		await mailService.sendActivationMail(email, `${process.env.API_URL}/api/activate/${activationLink}`);

		const userDto = new UserDto(user);
		const tokens = tokenService.generateToken({...userDto});
		await tokenService.saveToken(userDto.id, tokens.refreshToken);

		return{...tokens, user: userDto}
	}

	async activate(activationLink){
			const user = await UserModel.findOne({activationLink});
			if (!user){
				throw ApiError.BadRequest('Неккоректная ссылка активации')
			}
			user.isActivated = true;
			await user.save();
	}

	async login (email, password){
		const user = await UserModel.findOne({email})
		if (!user){
			throw ApiError.BadRequest('Пользователь с таким email не найден')
		}
		const isPassEquals = await bcrypt.compare(password, user.password);
		if(!isPassEquals){
			throw ApiError.BadRequest('Неверный пароль')
		}
		const userDto = new UserDto(user);
		const tokens = tokenService.generateToken({...userDto});
		await tokenService.saveToken(userDto.id, tokens.refreshToken);
		return{...tokens, user: userDto}
	}

	async logout (refreshToken){
		const token = await tokenService.removeToken(refreshToken);
		return token;
	}

	async refresh(refreshToken){
			if (!refreshToken){
				throw ApiError.UnauthorizedError();
			}
			const userData = tokenService.validateRefreshToken(refreshToken);
			const tokenFromDb = await tokenService.findToken(refreshToken);

			if(!userData || !tokenFromDb){
				throw ApiError.UnauthorizedError();
			}
			const user = await UserModel.findById(userData.id);
			const userDto = new UserDto(user);
			const tokens = tokenService.generateToken({...userDto});
			await tokenService.saveToken(userDto.id, tokens.refreshToken);
			return{...tokens, user: userDto}
	}

	async getAllUsers(){
		const users = await UserModel.find();
		return users;
	}

	async changePassword(email, password){
		const user = await UserModel.findOne({email})
		const isPassEquals = await bcrypt.compare(password, user.password);
		if(isPassEquals){
			throw ApiError.BadRequest('Пароли совпали')
		}
		const activationLink = user.activationLink
		await mailService.sendPasswordChangeMail(email, `${process.env.API_URL}/api/activateNewPassword/${activationLink}`);
		user.newPassword = await bcrypt.hash(password, 3);
		await user.save();
		return ('Для смены пароля требуется активация по почте')
	}

	async activateNewPassword(activationLink){
		const user = await UserModel.findOne({activationLink});
		if (!user){
			throw ApiError.BadRequest('Неккоректная ссылка активации')
		}
		user.password = user.newPassword
		user.newPassword = ''
		await user.save();
	}
}

module.exports = new UserService
