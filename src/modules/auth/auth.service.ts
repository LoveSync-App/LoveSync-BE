import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { User, UserDocument } from "../users/schemas/user.schema";
import { Model } from "mongoose";
import { LoginRequestDto } from "./dto/login-request.dto";
import { compare, hash } from "bcrypt";
import { JwtService } from "@nestjs/jwt";

@Injectable()
export class AuthService {
    constructor(
        @InjectModel(User.name)
        private readonly userModel: Model<UserDocument>,
        private readonly jwtService : JwtService
    ) {}

    async login(loginRequestDto : LoginRequestDto)
    {
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
}