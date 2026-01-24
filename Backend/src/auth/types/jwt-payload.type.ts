import {Role} from '../roles.enum';

export type JwtPayload = {
	sub: string;
	username: string;
	roles: Role[];
};
