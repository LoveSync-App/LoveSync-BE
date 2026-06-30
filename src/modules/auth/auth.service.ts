import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { User, UserDocument } from "../users/schemas/user.schema";
import { Model, Types } from "mongoose";
import { LoginRequestDto } from "./dto/login-request.dto";
import { compare, hash } from "bcrypt";
import { JwtService } from "@nestjs/jwt";
import { LoginRegisterDto } from "./dto/login-register.dto";
import { CoupleStatus } from "../couples/enum/couple-status.enum";
import { Couple, CoupleDocument } from "../couples/schemas/couple.schema";
import { Conversation, ConversationDocument } from "../chat/schemas/conversation.schema";
import { Message, MessageDocument } from "../chat/schemas/message.schema";

@Injectable()
export class AuthService {
    constructor(
        @InjectModel(User.name)
        private readonly userModel: Model<UserDocument>,
        private readonly jwtService: JwtService,

    ) { }

    async login(loginRequestDto: LoginRequestDto) {
        const { email, password } = loginRequestDto;

        // const hashPassword = await hash(password, 10);
        // console.log("Hash password: ", hashPassword);

        const user = await this.userModel.findOne({ email: email });
        if (!user) {
            throw new NotFoundException('User not found');
        }

        const isPasswordValid = await compare(password, user.password);
        if (!isPasswordValid) {
            throw new NotFoundException('Invalid password');
        }

        const accessToken = this.jwtService.sign(
            {
                sub: user._id,
                email: user.email,
            }
        )

        return {
            user: {
                id: user._id,
                email: user.email,
                name: user.name,
                avatar: user.avatar
            },
            accessToken
        }
    }


    async register(loginRegisterDto: LoginRegisterDto) {
        const { name, email, password, passwordConfirm } = loginRegisterDto;

        if (password !== passwordConfirm) {
            throw new BadRequestException('Password and password confirm do not match');
        }

        const existingUser = await this.userModel.findOne({ email: email });

        if (existingUser?.password) {
            throw new ConflictException('Email already exists');
        }
        if (existingUser && !existingUser.password) {
            const hashPassword = await hash(password, 10);
            existingUser.name = name;
            existingUser.password = hashPassword;
            await existingUser.save();
            return {
                id: existingUser._id,
                email: existingUser.email,
                name: existingUser.name,
                avatar: existingUser.avatar
            }
        }

        const hashPassword = await hash(password, 10);
        const newUser = new this.userModel({
            name,
            email,
            password: hashPassword,
            avatar: "https://i.pinimg.com/550x/0a/2f/68/0a2f68448ab64c7fb67e75ef410de163.jpg",
        });
        await newUser.save();
        return {
            id: newUser._id,
            email: newUser.email,
            name: newUser.name,
            avatar: newUser.avatar,
        };
    }

   
}