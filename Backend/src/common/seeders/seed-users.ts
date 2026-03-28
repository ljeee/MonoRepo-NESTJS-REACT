import 'reflect-metadata';
import {DataSource} from 'typeorm';
import {AppDataSource} from '../../data-source';
import {User} from '../../auth/esquemas/user.entity';
import {Role} from '../../auth/roles.enum';
import * as bcrypt from 'bcrypt';
import {Domiciliarios} from '../../domiciliarios/esquemas/domiciliarios.entity';

type UserSeed = {
	username: string;
	password: string;
	name: string;
	roles: Role[];
};

export async function seedUsers() {
	const dataSource = await AppDataSource.initialize();
	const userRepository = dataSource.getRepository(User);
	const domiciliarioRepository = dataSource.getRepository(Domiciliarios);

	try {
		console.log('🚀 Seeding users...');

		const users: UserSeed[] = [
			{
				username: 'admin',
				password: 'Dianakainlj1-_!',
				name: 'Admin',
				roles: [Role.Admin],
			},
			{
				username: '3117462406',
				password: '1234567891-_',
				name: 'CARACHO',
				roles: [Role.Domiciliario],
			},
			{
				username: '3058545970',
				password: '1234567891-_',
				name: 'GORDITO',
				roles: [Role.Domiciliario],
			},
			{
				username: '3194225123',
				password: '1234567891-_',
				name: 'JUANCHO',
				roles: [Role.Domiciliario],
			},
			{
				username: '3015324651',
				password: '1234567891-_',
				name: 'FELIPE',
				roles: [Role.Domiciliario],
			},
		];

		for (const userData of users) {
			const existing = await userRepository.findOne({where: {username: userData.username}});
			if (existing) {
				console.log(`ℹ️  User ${userData.username} already exists, skipping.`);
			} else {
				const hash = await bcrypt.hash(userData.password, 10);
				const user = userRepository.create({
					username: userData.username,
					name: userData.name,
					passwordHash: hash,
					roles: userData.roles,
				});
				await userRepository.save(user);
				console.log(`✅ User created: ${userData.username}`);
			}

			if (userData.roles.includes(Role.Domiciliario)) {
				const existingDom = await domiciliarioRepository.findOne({where: {telefono: userData.username}});
				if (!existingDom) {
					const newDom = domiciliarioRepository.create({
						telefono: userData.username,
						domiciliarioNombre: userData.name
					});
					await domiciliarioRepository.save(newDom);
					console.log(`✅ Domiciliario created in its table: ${userData.name}`);
				}
			}
		}

		console.log('✅ Users seeded successfully!');
	} catch (error) {
		console.error('❌ Error seeding users:', error);
		throw error;
	} finally {
		await dataSource.destroy();
	}
}

// If run directly
if (require.main === module) {
	seedUsers().catch(() => process.exit(1));
}