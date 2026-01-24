import {ApiProperty} from '@nestjs/swagger';
import {Role} from '../roles.enum';

export class AuthResponseDto {
	@ApiProperty()
	id: string;

	@ApiProperty()
	username: string;

	@ApiProperty({required: false})
	name?: string;

	@ApiProperty({isArray: true, enum: Role})
	roles: Role[];

	@ApiProperty()
	accessToken: string;
}
