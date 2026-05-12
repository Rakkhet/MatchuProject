import { useState } from 'react'
import BackgroundVideo from '../components/BackgroundVideo'
import { loginWithPassword, registerWithPassword, resetPassword } from '../lib/authApi'

var loginHeroVideo = '/matcha4.mp4'

export default function LoginPage(props) {
  var goHome = props.goHome
  var onLogin = props.onLogin

  // หน้า login นี้ไม่ได้มีแค่ sign in
  // แต่รวม register กับ forgot password ไว้ในหน้าเดียว แล้วสลับตาม mode
  var modeState = useState('login')
  var mode = modeState[0]
  var setMode = modeState[1]

  var displayNameState = useState('')
  var displayName = displayNameState[0]
  var setDisplayName = displayNameState[1]

  var emailState = useState('')
  var email = emailState[0]
  var setEmail = emailState[1]

  var passwordState = useState('')
  var password = passwordState[0]
  var setPassword = passwordState[1]

  var confirmPasswordState = useState('')
  var confirmPassword = confirmPasswordState[0]
  var setConfirmPassword = confirmPasswordState[1]

  var submitState = useState(false)
  var isSubmitting = submitState[0]
  var setIsSubmitting = submitState[1]

  var errorState = useState('')
  var error = errorState[0]
  var setError = errorState[1]

  var noticeState = useState('')
  var notice = noticeState[0]
  var setNotice = noticeState[1]

  var isRegisterMode = mode === 'register'
  var isForgotMode = mode === 'forgot'

  function resetForm() {
    // ล้างค่าที่ผู้ใช้กรอกไว้ในฟอร์ม
    setDisplayName('')
    setEmail('')
    setPassword('')
    setConfirmPassword('')
  }

  function toggleMode(e) {
    // สลับระหว่างหน้า login กับ register
    e.preventDefault()
    setError('')
    setNotice('')
    setMode(isRegisterMode ? 'login' : 'register')
  }

  function openForgotMode(e) {
    // เปิดโหมดลืมรหัสผ่าน
    // และล้างค่าบางช่องก่อนเพื่อไม่ให้ข้อมูลเก่าปนกัน
    e.preventDefault()
    setError('')
    setNotice('')
    setPassword('')
    setConfirmPassword('')
    setMode('forgot')
  }

  function goBackToLogin(e) {
    // กลับจากโหมดลืมรหัสผ่านมาหน้า login ปกติ
    e.preventDefault()
    setError('')
    setNotice('')
    setPassword('')
    setConfirmPassword('')
    setMode('login')
  }

  async function handleSubmit(e) {
    // ฟังก์ชัน submit ตัวเดียว แต่จะแยกการทำงานตาม mode
    // login = เข้าสู่ระบบ
    // register = สมัครสมาชิก
    // forgot = เปลี่ยนรหัสผ่านใหม่
    e.preventDefault()
    setError('')
    setNotice('')

    if (!email.trim() || !password.trim() || (isRegisterMode && !displayName.trim())) {
      setError('Please fill in all fields')
      return
    }

    if (isForgotMode && !confirmPassword.trim()) {
      setError('Please confirm your new password.')
      return
    }

    if (isForgotMode && password !== confirmPassword) {
      setError('Your new passwords do not match.')
      return
    }

    setIsSubmitting(true)

    try {
      if (isForgotMode) {
        var message = await resetPassword({
          email: email,
          password: password,
        })

        setNotice(message)
        setPassword('')
        setConfirmPassword('')
        setMode('login')
      } else {
        var user = isRegisterMode
          ? await registerWithPassword({
              displayName: displayName,
              email: email,
              password: password,
            })
          : await loginWithPassword({
              email: email,
              password: password,
            })

        onLogin(user)
        resetForm()
      }
    } catch (err) {
      setError(err && err.message ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="login-page">
      <button className="login-page-close" onClick={goHome} aria-label="Close">
        ✕
      </button>

      <div className="login-page-container">
        <div className="login-page-left">
          <div className="login-page-hero">
            <BackgroundVideo
              className="login-page-hero-video"
              src={loginHeroVideo}
              poster="/matcha4-poster.png"
              preload="auto"
            />
            <div className="login-page-hero-overlay" />
          </div>
        </div>

        <div className="login-page-right">
          <div className="login-page-content">
            <h1 className="login-page-title">
              {isRegisterMode ? 'Make it official' : isForgotMode ? 'Reset the ritual' : 'Oh look'}
            </h1>
            <p className="login-page-subtitle">
              {isRegisterMode ? 'JOIN THE CLUB' : isForgotMode ? 'FORGOT PASSWORD' : "WHO'S BACK"}
            </p>
            <p className="login-page-description">
              {isRegisterMode
                ? 'Create your Glowmore account and start building your matcha ritual.'
                : isForgotMode
                ? 'Enter the email on your account and choose a new password. For this project, the reset happens instantly.'
                : 'Sign back in to pick up where your last matcha order left off.'}
            </p>

            <form className="login-page-form" onSubmit={handleSubmit}>
              {isRegisterMode && (
                <div className="login-page-field">
                  <input
                    type="text"
                    placeholder="Display name"
                    className="login-page-input"
                    value={displayName}
                    onChange={function(e) { setDisplayName(e.target.value) }}
                    autoComplete="name"
                  />
                </div>
              )}

              <div className="login-page-field">
                <input
                  type={isForgotMode ? 'email' : 'text'}
                  placeholder={isForgotMode ? 'Email on your account' : 'Email or admin username'}
                  className="login-page-input"
                  value={email}
                  onChange={function(e) { setEmail(e.target.value) }}
                  autoComplete={isForgotMode ? 'email' : 'username'}
                />
              </div>

              <div className="login-page-field">
                <input
                  type="password"
                  placeholder={isForgotMode ? 'New password' : 'Password'}
                  className="login-page-input"
                  value={password}
                  onChange={function(e) { setPassword(e.target.value) }}
                  autoComplete={isRegisterMode || isForgotMode ? 'new-password' : 'current-password'}
                />
              </div>

              {isForgotMode ? (
                <div className="login-page-field">
                  <input
                    type="password"
                    placeholder="Confirm new password"
                    className="login-page-input"
                    value={confirmPassword}
                    onChange={function(e) { setConfirmPassword(e.target.value) }}
                    autoComplete="new-password"
                  />
                </div>
              ) : null}

              {!isRegisterMode && !isForgotMode ? (
                <div className="login-page-form-meta">
                  <button type="button" className="login-page-inline-action" onClick={openForgotMode}>
                    Forgot password?
                  </button>
                </div>
              ) : null}

              {error && <p className="login-page-error">{error}</p>}
              {notice && <p className="login-page-success">{notice}</p>}

              {isRegisterMode || isForgotMode ? (
                <p className="login-page-helper">
                  Use at least 8 characters for your password.
                  {isForgotMode ? ' The admin account cannot be reset from this form.' : ''}
                </p>
              ) : null}

              <button type="submit" className="login-page-button" disabled={isSubmitting}>
                {isSubmitting
                  ? 'WORKING...'
                  : isForgotMode
                  ? 'RESET PASSWORD'
                  : isRegisterMode
                  ? 'CREATE ACCOUNT'
                  : 'SIGN IN WITH SHOP'}
              </button>
            </form>

            <div className="login-page-footer">
              {isForgotMode ? (
                <p className="login-page-footer-text">
                  Remembered it?{' '}
                  <button type="button" className="login-page-footer-action" onClick={goBackToLogin}>
                    Back to sign in
                  </button>
                </p>
              ) : (
                <p className="login-page-footer-text">
                  {isRegisterMode ? 'Already have an account?' : "Don't have an account?"}{' '}
                  <button type="button" className="login-page-footer-action" onClick={toggleMode}>
                    {isRegisterMode ? 'Sign in' : 'Create one'}
                  </button>
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
