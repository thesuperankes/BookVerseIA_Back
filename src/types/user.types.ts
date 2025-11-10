export interface RegisterUserBody {
  email: string;
  password: string;
}

export interface LoginUserBody {
  email: string;
  password: string;
}

export interface ResetPasswordBody {
  email: string;
}

export interface UpdatePasswordBody {
  newPassword: string;
}
