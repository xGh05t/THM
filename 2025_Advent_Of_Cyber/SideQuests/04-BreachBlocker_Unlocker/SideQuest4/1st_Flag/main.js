let _s = null,
	_t = [],
	_a = 0,
	_i = null;
async function _c(e, m = 'GET', b = null) {
	const o = {
		method: m,
		headers: {
			'Content-Type': 'application/json'
		}
	};
	if (b) o.body = JSON.stringify(b);
	return fetch(e, o)
}
async function checkCredentials(e, p) {
	const st = performance.now();
	try {
		const r = await _c('/api/check-credentials', 'POST', {
			email: e,
			password: p
		});
		const d = await r.json();
		const et = performance.now();
		const tt = et - st;
		_t.push({
			email: e,
			password: p,
			time: tt,
			timestamp: et
		});
		return {
			valid: d.valid,
			time: tt
		}
	} catch (e) {
		console.error('API call failed:', e);
		return {
			valid: false,
			time: 0
		}
	}
}
document.getElementById('hopflixApp').addEventListener('click', async () => {
	document.getElementById('homeScreen').classList.add('hidden');
	document.getElementById('streamingView').classList.remove('hidden');
	document.getElementById('streamingEmail').value = 'sbreachblocker@easterbunnies.thm';
});
document.getElementById('bankApp').addEventListener('click', () => {
	window.bankAuthenticated = false;
	window.bank2FAVerified = false;
	document.getElementById('homeScreen').classList.add('hidden');
	document.getElementById('bankView').classList.remove('hidden');
	document.getElementById('bankLoginForm').classList.remove('hidden');
	document.getElementById('bankOtpForm').classList.add('hidden');
	document.getElementById('bank2FA').classList.add('hidden');
	document.getElementById('bankDashboard').classList.add('hidden');
});
document.getElementById('browserApp').addEventListener('click', () => {
	document.getElementById('homeScreen').classList.add('hidden');
	document.getElementById('browserView').classList.remove('hidden');
});
document.getElementById('backFromBrowser').addEventListener('click', () => {
	document.getElementById('browserView').classList.add('hidden');
	document.getElementById('homeScreen').classList.remove('hidden');
});
document.getElementById('phoneApp').addEventListener('click', () => {
	document.getElementById('homeScreen').classList.add('hidden');
	document.getElementById('phoneView').classList.remove('hidden');
});
document.getElementById('backFromPhone').addEventListener('click', () => {
	document.getElementById('phoneView').classList.add('hidden');
	document.getElementById('homeScreen').classList.remove('hidden');
});
document.getElementById('authenticatorApp').addEventListener('click', () => {
	document.getElementById('homeScreen').classList.add('hidden');
	document.getElementById('authenticatorView').classList.remove('hidden');
	document.getElementById('faceIdPrompt').style.display = 'flex';
	document.getElementById('authenticatorCodeView').classList.add('hidden');
	document.getElementById('faceIdError').style.display = 'none';
	startFaceID();
});

function startFaceID() {
	const _fi = document.getElementById('faceIdIcon');
	const _sl = document.getElementById('faceIdScanLine');
	const _ed = document.getElementById('faceIdError');
	_fi.style.borderColor = '#fff';
	_fi.style.animation = 'faceIdPulse 2s ease-in-out infinite';
	_sl.style.animation = 'scan 2s ease-in-out infinite';
	_sl.style.display = 'block';
	_ed.style.display = 'none';
	const _sd = 2000 + Math.random() * 1000;
	setTimeout(() => {
			_fi.style.animation = 'none';
			_sl.style.animation = 'none';
			_sl.style.display = 'none';
			_fi.style.borderColor = '#ff3b30';
			_fi.innerHTML = '<div style="font-size: 60px; color: #ff3b30;">✗</div>';
			_ed.style.display = 'block';
			setTimeout(() => {
				startFaceID();
			}, 1000);
	}, _sd);
}
document.getElementById('faceIdCancel').addEventListener('click', () => {
	document.getElementById('authenticatorView').classList.add('hidden');
	document.getElementById('homeScreen').classList.remove('hidden');
});
document.getElementById('settingsApp').addEventListener('click', () => {
	document.getElementById('homeScreen').classList.add('hidden');
	document.getElementById('settingsView').classList.remove('hidden');
	document.getElementById('securityPasscodeLock').classList.add('hidden');
	document.getElementById('settingsList').style.display = 'block';
	document.getElementById('securitySettings').classList.add('hidden');
	document.getElementById('twoFactorAuthSettings').classList.add('hidden');
});
document.getElementById('backFromSettings').addEventListener('click', () => {
	document.getElementById('settingsView').classList.add('hidden');
	document.getElementById('homeScreen').classList.remove('hidden');
});
setTimeout(() => {
	const _si = document.getElementById('settingsSearch');
	if (_si) {
		_si.addEventListener('input', (e) => {
			const _st = e.target.value.toLowerCase();
			const _it = document.querySelectorAll('.settings-item[data-search]');
			_it.forEach(_i => {
				const _stx = _i.dataset.search.toLowerCase();
				if (_stx.includes(_st) || _st === '') {
					_i.classList.remove('hidden');
				} else {
					_i.classList.add('hidden');
				}
			});
		});
	}
	document.querySelectorAll('.settings-item[data-search*="security"]').forEach(_i => {
		_i.addEventListener('click', () => {
			document.getElementById('settingsList').style.display = 'none';
			document.getElementById('securitySettings').classList.remove('hidden');
		});
	});
	const backFromSecurityBtn = document.getElementById('backFromSecuritySettings');
	if (backFromSecurityBtn) {
		backFromSecurityBtn.addEventListener('click', () => {
			document.getElementById('securitySettings').classList.add('hidden');
			document.getElementById('settingsList').style.display = 'block';
		});
	}
	const changePasscodeItem = document.getElementById('changePasscodeItem');
	if (changePasscodeItem) {
		changePasscodeItem.addEventListener('click', () => {
			const faceIdPrompt = document.getElementById('changePasscodeFaceId');
			faceIdPrompt.classList.remove('hidden');
			faceIdPrompt.style.display = 'flex';
			startChangePasscodeFaceID();
		});
	}

	function startChangePasscodeFaceID() {
		const _fi = document.getElementById('changePasscodeFaceIdIcon');
		const _sl = document.getElementById('changePasscodeScanLine');
		const _ed = document.getElementById('changePasscodeFaceIdError');
		_fi.style.borderColor = '#fff';
		_fi.style.animation = 'faceIdPulse 2s ease-in-out infinite';
		_sl.style.animation = 'scan 2s ease-in-out infinite';
		_sl.style.display = 'block';
		_ed.style.display = 'none';
		_fi.innerHTML = '<div style="font-size: 60px; color: #fff;">👤</div><div id="changePasscodeScanLine" style="position: absolute; top: 0; left: 0; right: 0; width: 100%; height: 2px; background: linear-gradient(to bottom, rgba(0,255,0,0.8), rgba(0,255,0,0.3));"></div>';
		const _sd = 2000 + Math.random() * 1000;
		setTimeout(() => {
			_fi.style.animation = 'none';
			_sl.style.animation = 'none';
			_sl.style.display = 'none';
			_fi.style.borderColor = '#ff3b30';
			_fi.innerHTML = '<div style="font-size: 60px; color: #ff3b30;">✗</div>';
			_ed.style.display = 'block';
			setTimeout(() => {
				startChangePasscodeFaceID();
			}, 1000);
		}, _sd);
	}
	const changePasscodeCancelBtn = document.getElementById('changePasscodeFaceIdCancel');
	if (changePasscodeCancelBtn) {
		changePasscodeCancelBtn.addEventListener('click', () => {
			document.getElementById('changePasscodeFaceId').classList.add('hidden');
			document.getElementById('changePasscodeFaceId').style.display = 'none';
		});
	}
	const twoFactorAuthItem = document.getElementById('twoFactorAuthItem');
	if (twoFactorAuthItem) {
		twoFactorAuthItem.addEventListener('click', () => {
			document.getElementById('securitySettings').classList.add('hidden');
			document.getElementById('twoFactorAuthSettings').classList.remove('hidden');
		});
	}
	const backFromTwoFactorAuthBtn = document.getElementById('backFromTwoFactorAuth');
	if (backFromTwoFactorAuthBtn) {
		backFromTwoFactorAuthBtn.addEventListener('click', () => {
			document.getElementById('twoFactorAuthSettings').classList.add('hidden');
			document.getElementById('securitySettings').classList.remove('hidden');
		});
	}
	const PHONE_PASSCODE = "210701";
	let _sep = "";

	function updateSecurityPasscodeDots() {
		for (let i = 1; i <= 6; i++) {
			const _dt = document.getElementById(`securityPasscodeDot${i}`);
			if (_dt) {
				if (i <= _sep.length) {
					_dt.style.background = '#fff';
					_dt.style.borderColor = '#fff';
				} else {
					_dt.style.background = 'transparent';
					_dt.style.borderColor = '#666';
				}
			}
		}
	}
	const _ft = document.getElementById('faceIdToggle');
	if (_ft) {
		_ft.addEventListener('change', (e) => {
			if (!e.target.checked) {
				e.target.checked = true;
				const _pl = document.getElementById('securityPasscodeLock');
				_pl.classList.remove('hidden');
				_pl.style.display = 'flex';
				_sep = "";
				updateSecurityPasscodeDots();
			} else {
				window.faceIdDisabled = false;
			}
		});
	}
	document.querySelectorAll('.security-passcode-btn[data-digit]').forEach(btn => {
		btn.addEventListener('click', () => {
			if (_sep.length < 6) {
				_sep += btn.dataset.digit;
				updateSecurityPasscodeDots();
				if (_sep.length === 6) {
					setTimeout(() => {
						if (_sep === PHONE_PASSCODE) {
							const _pl = document.getElementById('securityPasscodeLock');
							_pl.classList.add('hidden');
							_pl.style.display = 'none';
							_ft.checked = false;
							window.faceIdDisabled = true;
							_sep = "";
						} else {
							const _ed = document.getElementById('securityPasscodeError');
							if (_ed) {
								_ed.style.display = 'block';
							}
							_sep = "";
							updateSecurityPasscodeDots();
							setTimeout(() => {
								if (_ed) {
									_ed.style.display = 'none';
								}
							}, 2000);
						}
					}, 200);
				}
			}
		});
	});
	const securityDeleteBtn = document.getElementById('securityPasscodeDelete');
	if (securityDeleteBtn) {
		securityDeleteBtn.addEventListener('click', () => {
			if (_sep.length > 0) {
				_sep = _sep.slice(0, -1);
				updateSecurityPasscodeDots();
			}
		});
	}
	const securityCancelBtn = document.getElementById('securityPasscodeCancel');
	if (securityCancelBtn) {
		securityCancelBtn.addEventListener('click', () => {
			const _pl = document.getElementById('securityPasscodeLock');
			_pl.classList.add('hidden');
			_pl.style.display = 'none';
			_sep = "";
			updateSecurityPasscodeDots();
		});
	}
}, 100);
document.getElementById('backFromAuthenticator').addEventListener('click', () => {
	document.getElementById('authenticatorView').classList.add('hidden');
	document.getElementById('homeScreen').classList.remove('hidden');
});
const _av = document.getElementById('authenticatorView');
document.getElementById('mailApp').addEventListener('click', () => {
	document.getElementById('homeScreen').classList.add('hidden');
	document.getElementById('mailView').classList.remove('hidden');
});
document.getElementById('backFromMail').addEventListener('click', () => {
	document.getElementById('mailView').classList.add('hidden');
	document.getElementById('homeScreen').classList.remove('hidden');
});
document.getElementById('photosApp').addEventListener('click', () => {
	document.getElementById('homeScreen').classList.add('hidden');
	document.getElementById('photosView').classList.remove('hidden');
});
document.getElementById('backFromPhotos').addEventListener('click', () => {
	document.getElementById('photosView').classList.add('hidden');
	document.getElementById('homeScreen').classList.remove('hidden');
});
window.openPhoto = function(_ps) {
	document.getElementById('viewerImage').src = _ps;
	const _v = document.getElementById('photoViewer');
	_v.classList.remove('hidden');
	_v.style.display = 'flex';
};
document.getElementById('closePhotoViewer').addEventListener('click', () => {
	const _v = document.getElementById('photoViewer');
	_v.classList.add('hidden');
	_v.style.display = 'none';
});
document.getElementById('photoViewer').addEventListener('click', (e) => {
	if (e.target.id === 'photoViewer') {
		const _v = document.getElementById('photoViewer');
		_v.classList.add('hidden');
		_v.style.display = 'none';
	}
});
document.getElementById('messagesApp').addEventListener('click', () => {
	document.getElementById('homeScreen').classList.add('hidden');
	document.getElementById('messagesListView').classList.remove('hidden');
});
document.getElementById('backFromMessagesList').addEventListener('click', () => {
	document.getElementById('messagesListView').classList.add('hidden');
	document.getElementById('homeScreen').classList.remove('hidden');
});
window.openConversation = function(_conv) {
	document.getElementById('messagesListView').classList.add('hidden');
	document.getElementById('messagesView').classList.remove('hidden');
	if (_conv === 'drHairwell') {
		document.getElementById('drHairwellConversation').classList.remove('hidden');
		document.getElementById('unknownConversation').classList.add('hidden');
		document.getElementById('bestieConversation').classList.add('hidden');
		document.getElementById('jesterConversation').classList.add('hidden');
		document.getElementById('kingMalhareConversation').classList.add('hidden');
		document.getElementById('carrotBaneConversation').classList.add('hidden');
		document.getElementById('conversationHeader').textContent = 'Dr. Hairwell';
		document.getElementById('conversationSubtitle').textContent = 'Ear Hair Specialist';
	} else if (_conv === 'unknown') {
		document.getElementById('drHairwellConversation').classList.add('hidden');
		document.getElementById('unknownConversation').classList.remove('hidden');
		document.getElementById('bestieConversation').classList.add('hidden');
		document.getElementById('jesterConversation').classList.add('hidden');
		document.getElementById('kingMalhareConversation').classList.add('hidden');
		document.getElementById('carrotBaneConversation').classList.add('hidden');
		document.getElementById('conversationHeader').textContent = '+44 7911 123456';
		document.getElementById('conversationSubtitle').textContent = '';
	} else if (_conv === 'bestie') {
		document.getElementById('drHairwellConversation').classList.add('hidden');
		document.getElementById('unknownConversation').classList.add('hidden');
		document.getElementById('bestieConversation').classList.remove('hidden');
		document.getElementById('jesterConversation').classList.add('hidden');
		document.getElementById('kingMalhareConversation').classList.add('hidden');
		document.getElementById('carrotBaneConversation').classList.add('hidden');
		document.getElementById('conversationHeader').textContent = 'Bestie';
		document.getElementById('conversationSubtitle').textContent = '';
	} else if (_conv === 'jester') {
		document.getElementById('drHairwellConversation').classList.add('hidden');
		document.getElementById('unknownConversation').classList.add('hidden');
		document.getElementById('bestieConversation').classList.add('hidden');
		document.getElementById('jesterConversation').classList.remove('hidden');
		document.getElementById('kingMalhareConversation').classList.add('hidden');
		document.getElementById('carrotBaneConversation').classList.add('hidden');
		document.getElementById('conversationHeader').textContent = 'JEster';
		document.getElementById('conversationSubtitle').textContent = 'Best Bud';
	} else if (_conv === 'kingMalhare') {
		document.getElementById('drHairwellConversation').classList.add('hidden');
		document.getElementById('unknownConversation').classList.add('hidden');
		document.getElementById('bestieConversation').classList.add('hidden');
		document.getElementById('jesterConversation').classList.add('hidden');
		document.getElementById('kingMalhareConversation').classList.remove('hidden');
		document.getElementById('carrotBaneConversation').classList.add('hidden');
		document.getElementById('conversationHeader').textContent = 'King Malhare';
		document.getElementById('conversationSubtitle').textContent = 'Ruler of HopSec Island';
	} else if (_conv === 'carrotBane') {
		document.getElementById('drHairwellConversation').classList.add('hidden');
		document.getElementById('unknownConversation').classList.add('hidden');
		document.getElementById('bestieConversation').classList.add('hidden');
		document.getElementById('jesterConversation').classList.add('hidden');
		document.getElementById('kingMalhareConversation').classList.add('hidden');
		document.getElementById('carrotBaneConversation').classList.remove('hidden');
		document.getElementById('conversationHeader').textContent = 'Sir CarrotBane';
		document.getElementById('conversationSubtitle').textContent = 'Head of Red Team Battalion';
	}
};
document.getElementById('backFromMessages').addEventListener('click', () => {
	document.getElementById('messagesView').classList.add('hidden');
	document.getElementById('messagesListView').classList.remove('hidden');
});
document.getElementById('backFromStreaming').addEventListener('click', () => {
	document.getElementById('streamingView').classList.add('hidden');
	document.getElementById('homeScreen').classList.remove('hidden');
	document.getElementById('streamingLoginScreen').classList.remove('hidden');
	document.getElementById('streamingBrowseScreen').classList.add('hidden');
});
document.getElementById('backFromBrowse').addEventListener('click', () => {
	document.getElementById('streamingView').classList.add('hidden');
	document.getElementById('homeScreen').classList.remove('hidden');
	document.getElementById('streamingLoginScreen').classList.remove('hidden');
	document.getElementById('streamingBrowseScreen').classList.add('hidden');
});
document.getElementById('backFromBank').addEventListener('click', () => {
	document.getElementById('bankView').classList.add('hidden');
	document.getElementById('homeScreen').classList.remove('hidden');
});
document.getElementById('streamingLoginForm').addEventListener('submit', async (e) => {
	e.preventDefault();
	const _em = document.getElementById('streamingEmail').value;
	const _pw = document.getElementById('streamingPassword').value;
	const _ed = document.getElementById('streamingError');
	const _sb = e.target.querySelector('button[type="submit"]');
	_ed.style.display = 'none';
	_sb.disabled = true;
	_sb.textContent = 'Signing in...';
	_a++;
	const _r = await checkCredentials(_em, _pw);
	_sb.disabled = false;
	_sb.textContent = 'Sign In';
	if (_r.valid) {
		try {
			const lastViewedResponse = await _c('/api/get-last-viewed');
			const data = await lastViewedResponse.json();
			document.getElementById('streamingLoginScreen').classList.add('hidden');
			document.getElementById('streamingBrowseScreen').classList.remove('hidden');
			document.getElementById('continueWatchingFlag').textContent = data.last_viewed;
		} catch (_e) {
			console.error('Login failed:', _e);
			_ed.style.display = 'block';
		}
	} else {
		_ed.style.display = 'block';
	}
});
const bankLoginHandler = async () => {
	const _aid = document.getElementById('bankAccountId').value;
	const _pn = document.getElementById('bankPin').value;
	const _ed = document.getElementById('bankError');
	const _lb = document.getElementById('bankLoginButton');
	const _oes = document.getElementById('otpEmailSelect');
	_ed.style.display = 'none';
	_lb.disabled = true;
	_lb.textContent = 'Accessing...';
	try {
		const _rs = await _c('/api/bank-login', 'POST', {
			account_id: _aid,
			pin: _pn
		});
		const _d = await _rs.json();
		if (_rs.ok && _d.success) {
			window.bankAuthenticated = true;
			window.bank2FAVerified = false;
			
			_oes.innerHTML = "";
			for(te of _d.trusted_emails){
				_oes.options[_oes.options.length] = new Option(te, te);
			}

			document.getElementById('bankLoginForm').classList.add('hidden');
			document.getElementById('bankOtpForm').classList.remove('hidden');
		} else {
			_ed.style.display = 'block';
			_ed.textContent = _d.error || 'Invalid credentials';
		}
	} catch (_e) {
		_ed.style.display = 'block';
		_ed.textContent = 'Login failed. Please try again.';
	}
	_lb.disabled = false;
	_lb.textContent = 'Access Account';
};
const bankOtpHandler = async () => {
	const _aid = document.getElementById('otpEmailSelect').value;
	const _ed = document.getElementById('otpError');
	const _lb = document.getElementById('sendOtpButton');
	_ed.style.display = 'none';
	_lb.disabled = true;
	_lb.textContent = 'Accessing...';
	try {
		const _rs = await _c('/api/send-2fa', 'POST', {
			otp_email: _aid
		});
		const _d = await _rs.json();
		if (_rs.ok && _d.success) {
			window.bankAuthenticated = true;
			window.bank2FAVerified = false;
			document.getElementById('bankOtpForm').classList.add('hidden');
			document.getElementById('bank2FA').classList.remove('hidden');
		} else {
			_ed.style.display = 'block';
			_ed.textContent = _d.error || 'Error sending OTP';
		}
	} catch (_e) {
		_ed.style.display = 'block';
		_ed.textContent = 'OTP generation failed. Please try again.';
	}
	_lb.disabled = false;
	_lb.textContent = 'Access Account';
};
const verify2FA = async () => {
	const code1 = document.getElementById('code1').value;
	const code2 = document.getElementById('code2').value;
	const code3 = document.getElementById('code3').value;
	const code4 = document.getElementById('code4').value;
	const code5 = document.getElementById('code5').value;
	const code6 = document.getElementById('code6').value;
	const _ec = code1 + code2 + code3 + code4 + code5 + code6;
	const _ed = document.getElementById('twoFAError');
	const _vb = document.getElementById('verify2FAButton');
	_ed.style.display = 'none';
	_vb.disabled = true;
	_vb.textContent = 'Verifying...';
	try {
		const _rs = await _c('/api/verify-2fa', 'POST', {
			code: _ec
		});
		const _d = await _rs.json();
		if (_rs.ok && _d.success) {
			window.bank2FAVerified = true;
			document.getElementById('bank2FA').classList.add('hidden');
			document.getElementById('bankDashboard').classList.remove('hidden');
		} else {
			_ed.style.display = 'block';
			_ed.textContent = _d.error || 'Invalid code';
			_vb.disabled = false;
			_vb.textContent = 'Verify';
			['code1', 'code2', 'code3', 'code4', 'code5', 'code6'].forEach(id => {
				document.getElementById(id).value = '';
			});
		}
	} catch (_e) {
		_ed.style.display = 'block';
		_ed.textContent = 'Verification failed. Please try again.';
		_vb.disabled = false;
		_vb.textContent = 'Verify';
	}
};
document.getElementById('verify2FAButton').addEventListener('click', verify2FA);
['code1', 'code2', 'code3', 'code4', 'code5', 'code6'].forEach((id, _idx) => {
	const _in = document.getElementById(id);
	_in.addEventListener('input', (e) => {
		if (e.target.value && _idx < 5) {
			document.getElementById(['code1', 'code2', 'code3', 'code4', 'code5', 'code6'][_idx + 1]).focus();
		}
	});
	_in.addEventListener('keydown', (e) => {
		if (e.key === 'Backspace' && !e.target.value && _idx > 0) {
			document.getElementById(['code1', 'code2', 'code3', 'code4', 'code5', 'code6'][_idx - 1]).focus();
		}
	});
});
document.getElementById('code6').addEventListener('keypress', (e) => {
	if (e.key === 'Enter') {
		verify2FA();
	}
});
document.getElementById('bankLoginButton').addEventListener('click', bankLoginHandler);
document.getElementById('bankPin').addEventListener('keypress', (e) => {
	if (e.key === 'Enter') {
		bankLoginHandler();
	}
});
document.getElementById('sendOtpButton').addEventListener('click', bankOtpHandler);

window.bankAuthenticated = false;
window.bank2FAVerified = false;
document.getElementById('releaseButton').addEventListener('click', async () => {
	if (!window.bankAuthenticated || !window.bank2FAVerified) {
		alert('Access denied. Please complete authentication first.');
		return;
	}
	try {
		const _rs = await _c('/api/release-funds', 'POST');
		const _d = await _rs.json();
		if (_rs.ok && _d.flag) {
			document.getElementById('releaseButton').disabled = true;
			document.getElementById('releaseButton').textContent = 'Funds Released';
			document.getElementById('releaseButton').style.background = '#00c853';
			const _ti = document.querySelector('.transaction-item');
			_ti.querySelector('.transaction-label').innerHTML = '<div>AoC Festival Charity Fund</div><div style="font-size: 12px; color: #4caf50; margin-top: 5px;">Status: Released ✓</div>';
			document.getElementById('flagDisplay').style.display = 'block';
			document.getElementById('flagDisplay').textContent = _d.flag;
		} else {
			alert('Failed to release funds. Please try again.');
		}
	} catch (_e) {
		console.error('Failed to release funds:', _e);
		alert('Failed to release funds. Please try again.');
	}
});
