export const translateAuthError = (message: string): string => {
    if (message.includes('Invalid login credentials')) {
        return 'Correo o contraseña incorrectos. Verifica tus datos e intenta de nuevo.';
    }
    if (message.includes('Email not confirmed')) {
        return 'Tu correo aún no ha sido verificado. Revisa tu bandeja de entrada y haz clic en el enlace de confirmación.';
    }
    if (message.includes('User already registered')) {
        return 'Ya existe una cuenta con este correo. Intenta iniciar sesión.';
    }
    if (message.includes('Password should be at least')) {
        return 'La contraseña debe tener al menos 6 caracteres.';
    }
    if (message.includes('Unable to validate email address')) {
        return 'El formato del correo electrónico no es válido.';
    }
    if (message.includes('Email rate limit exceeded')) {
        return 'Demasiados intentos. Espera unos minutos antes de intentarlo de nuevo.';
    }
    if (message.includes('signup_disabled')) {
        return 'El registro de nuevos usuarios está temporalmente deshabilitado.';
    }
    return message;
};
