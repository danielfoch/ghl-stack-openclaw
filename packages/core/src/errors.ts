export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly retryable = false,
    public readonly status = 400
  ) {
    super(message);
  }
}

export class PermissionError extends AppError {
  constructor(message = "permission denied") {
    super("PERMISSION_DENIED", message, false, 403);
  }
}

export class ValidationError extends AppError {
  constructor(message = "invalid input") {
    super("VALIDATION_ERROR", message, false, 400);
  }
}

export class ProviderError extends AppError {
  constructor(message: string, retryable = true) {
    super("PROVIDER_ERROR", message, retryable, 502);
  }
}

export class IdempotentReplayError extends AppError {
  constructor() {
    super("IDEMPOTENT_REPLAY", "request already processed", false, 200);
  }
}
