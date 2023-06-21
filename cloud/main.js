const Professional = Parse.Object.extend('Professional');
const Specialty = Parse.Object.extend('Specialty');
const Schedule = Parse.Object.extend('Schedule');

Parse.Cloud.define('v1-sign-in', async (req) => {
	const user = await Parse.User.logIn(req.params.email.toLowerCase(), req.params.password);
	return formatUser(user.toJSON());
}, {
	fields: {
		email: {
			required: true
		},
		password: {
			required: true
		}
	}
});

Parse.Cloud.define('v1-get-user', async (req) => {
	return formatUser(req.user.toJSON());
});

Parse.Cloud.define('v1-sign-up', async (req) => {
	const user = new Parse.User();
	user.set('email', req.params.email.toLowerCase());
	user.set('username', req.params.email.toLowerCase());
	user.set('fullname', req.params.fullname);
	user.set('phone', req.params.phone);
	user.set('document', req.params.document);
	user.set('password', req.params.password);
	await user.signUp(null, {useMasterKey: true});
	return formatUser(user.toJSON());
}, {
	fields: {
		email: {
			required: true
		},
		password: {
			required: true
		},
		fullname: {
			required: true
		},
		document: {
			required: true
		},
		phone: {
			required: true
		},
	}
});

Parse.Cloud.define('v1-get-professionals', async (req) => {
	const query = new Parse.Query(Professional);
	query.include('specialties', 'insurances', 'services');

	if(req.params.specialtyId) {
		const specialty = new Specialty();
		specialty.id = req.params.specialtyId;
		query.equalTo('specialties', specialty);
	}

	if(req.params.lat && req.params.long) {
		const point = new Parse.GeoPoint({latitude: req.params.lat, longitude: req.params.long});
		query.withinKilometers('location', point, req.params.maxDistance || 50);
	}

	if(req.params.limit && req.params.skip) {
		query.limit(req.params.limit);
		query.skip(req.params.skip);
	}
	
	const results = await query.find({useMasterKey: true});
	return results.map((r) => formatProfessional(r.toJSON()));
}, {
	fields: {
		
	}
});

Parse.Cloud.define('v1-get-scheduling-slots', async (req) => {
	const duration = req.params.duration;
	const professionalId = req.params.professionalId;
	const startDate = new Date(req.params.startDate);
	const endDate = new Date(req.params.endDate);

	const professional = new Professional();
	professional.id = professionalId;
	await professional.fetch({useMasterKey: true});

	const schedulingsQuery = new Parse.Query(Schedule);
	schedulingsQuery.equalTo('professional', professional);
	schedulingsQuery.greaterThanOrEqualTo('startDate', startDate);
	schedulingsQuery.lessThanOrEqualTo('endDate', endDate);
	schedulingsQuery.ascending('startDate');
	const schedulings = await schedulingsQuery.find({useMasterKey: true});

	let days = 0;
	const availableSlots = [];

	while(days < 60) {
		const currentDate = new Date(startDate.getTime() + days * 24 * 60 * 60 * 1000);
		days += 1;

		if(currentDate >= endDate) break;

		let weekday = currentDate.getDay();
		if(weekday == 0) weekday = 7;

		const workSlots = professional.get('scheduleRule').filter((s) => s.weekday == weekday);

		const availableSlotsInDay = [];

		for(const workSlot of workSlots) {
			const diffStart = new Date(workSlot.startTime) - new Date('2000-01-01T00:00:00.000Z');
			const diffEnd = new Date(workSlot.endTime) - new Date('2000-01-01T00:00:00.000Z');
		
			const workSlotStart = new Date(currentDate.getTime() + diffStart);
			const workSlotEnd = new Date(currentDate.getTime() + diffEnd);

			let minutes = 0;

			while(minutes < 24 * 60) {
				const testSlotStart = new Date(workSlotStart.getTime() + minutes * 60 * 1000);
				const testSlotEnd = new Date(testSlotStart.getTime() + duration * 60 * 1000);

				minutes += professional.get('slotInterval');

				if(testSlotEnd > workSlotEnd) break;

				for(const schedule of schedulings) {
					if(testSlotEnd <= schedule.get('startDate')) {
						availableSlotsInDay.push(
							{
								startDate: testSlotStart.toISOString(),
								endDate: testSlotEnd.toISOString()
							}
						);
						break;
					} else if(testSlotEnd <= schedule.get('endDate') || testSlotStart < schedule.get('endDate')){
						break;
					} else if(schedule === schedulings[schedulings.length - 1]) {
						availableSlotsInDay.push(
							{
								startDate: testSlotStart.toISOString(),
								endDate: testSlotEnd.toISOString()
							}
						);
						break;
					}
				}
			}
		}

		availableSlots.push(
			{
				date: currentDate.toISOString(),
				slots: availableSlotsInDay,
			}
		)
	}

	return availableSlots;

}, {
	fields: {
		duration: {
			required: true,
		},
		professionalId: {
			required: true
		}
	}
});

function formatSpecialty(s) {
	return {
		id: s.objectId,
		name: s.name
	}
}

function formatProfessional(p) {
	return {
		id: p.objectId,
		name: p.name,
		specialties: p.specialties.map((s) => formatSpecialty(s)),
		crm: p.crm,
	};
}

function formatUser(u) {
	return {
		id: u.objectId,
		token: u.sessionToken,
		fullname: u.fullname,
		document: u.document,
		phone: u.phone,
	}
}
