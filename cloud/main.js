const Professional = Parse.Object.extend('Professional');
const Specialty = Parse.Object.extend('Specialty');

Parse.Cloud.define('v1-sign-in', async (req) => {
	const user = Parse.User.signIn(req.params.email.toLowerCase(), req.params.password);
	return formatUser(user.toJSON());
}, {
	fields: {
		email: {
			required: true,
		},
		password: {
			required: true,
		},
	}
});

Parse.Cloud.define('v1-get-user', async (req) => {
	return formatUser(req.user.toJSON());
});

Parse.Cloud.define('v1-sign-up', async (req) => {
	const user = new Parse.User();
	user.set('email', req.params.email.toLowerCase());
	user.set('username', req.params.email.toLowerCase());
	user.set('fullname', req.params.fullName);
	user.set('phone', req.params.phone);
	user.set('document', req.params.document);
	user.set('password', req.params.password);
	await user.signUp(null, {useMasterKey: true});
	return formatUser(user.toJSON());
}, {
	fields: {
		email: {
			required: true,
		},
		password: {
			required: true,
		},
		fullname: {
			required: true,
		},
		document: {
			required: true,
		},
		phone: {
			required: true,
		},
	}
});

Parse.Cloud.define('v1-get-professionals', async (req) => {
    const query = new Parse.Query(Professional);
	query.include('specialties', 'insurences', 'services');

	if (req.params.specialtyId) {
		const specialty = new Specialty();
		specialty.id = req.params.specialtyId;
		query.equalTo('specialties', specialty);
	}

	if (req.params.lat && req.params.lng) {
		const point = new Parse.GeoPoint({latitude: req.params.lat, longitude: req.params.lng});
		query.withinKilometers('location', point, req.params.maxDistance || 100);
	}

	if (req.params.limit && req.params.skip) {
		query.limit(req.params.limit);
		query.skip(req.params.skip);
	}

	const results = await query.find({useMasterKey: true});
	// return results;
	return results.map((r) => formatProfessional(r.toJSON()));
}, {
	fields: {
		specialtyId: {}
	},
});

function formatProfessional(p) {
	return {
		id: p.objectId,
		name: p.name,
		specialties: p.specialties.map((s) => formatSpecialty(s)),
		crm: p.crm,
	}
}

function formatSpecialty(s) {
	return {
		id: s.objectId,
		name: s.name,
	}
}

function formatUser(u) {
	return {
		id: u.objectId,
		fullname: u.fullname,
		document: u.document,
		phone: u.phone,
	}
}
