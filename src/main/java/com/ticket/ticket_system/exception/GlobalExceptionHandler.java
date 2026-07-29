package com.ticket.ticket_system.exception;

import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashMap;
import java.util.Map;

/**
 * {@link RestControllerAdvice} that catches exceptions thrown by controllers
 * and returns user-friendly JSON error responses with appropriate HTTP status codes.
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    /**
     * Handles database constraint violations and returns a user-friendly message
     * based on the constraint type (foreign key references to organizations, services, roles, or users).
     *
     * @param ex the caught {@link DataIntegrityViolationException}
     * @return a 409 Conflict response with a descriptive message
     */
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<Map<String, String>> handleDataIntegrityViolation(DataIntegrityViolationException ex) {
        Map<String, String> error = new HashMap<>();
        String message = ex.getMessage() != null ? ex.getMessage().toLowerCase() : "";

        if (message.contains("organization_id") || message.contains("organizations")) {
            if (message.contains("tickets")) {
                error.put("message", "This organization can't be deleted because it's linked to existing tickets");
            } else if (message.contains("users")) {
                error.put("message", "This organization can't be deleted because it's linked to existing users");
            } else {
                error.put("message", "This organization can't be deleted because it's linked to existing records");
            }
        } else if (message.contains("service_id") || message.contains("services")) {
            error.put("message", "This service can't be deleted because it's linked to existing tickets");
        } else if (message.contains("role_id") || message.contains("roles")) {
            error.put("message", "This role can't be deleted because it's linked to existing users");
        } else if (message.contains("user_id") || message.contains("assigned_to") || message.contains("users")) {
            error.put("message", "This user can't be deleted because it's linked to existing tickets");
        } else if (message.contains("foreign key") ||
                   message.contains("referential integrity") ||
                   message.contains("constraint")) {
            error.put("message", "This item is in use and cannot be deleted. Please remove all references first.");
        } else {
            error.put("message", "Operation failed due to data constraint.");
        }

        return ResponseEntity.status(HttpStatus.CONFLICT).body(error);
    }

    /**
     * Handles {@link ResponseStatusException} and returns the embedded HTTP status and reason.
     *
     * @param ex the caught {@link ResponseStatusException}
     * @return a response with the exception's status code and reason
     */
    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, String>> handleResponseStatusException(ResponseStatusException ex) {
        Map<String, String> error = new HashMap<>();
        error.put("message", ex.getReason());
        return ResponseEntity.status(ex.getStatusCode()).body(error);
    }

    /**
     * Handles validation failures on {@link org.springframework.web.bind.annotation.RequestBody} arguments.
     * Returns a map of field names to validation error messages.
     *
     * @param ex the caught {@link MethodArgumentNotValidException}
     * @return a 400 Bad Request response with field-level errors
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, String>> handleValidation(MethodArgumentNotValidException ex) {
        Map<String, String> errors = new HashMap<>();
        ex.getBindingResult().getFieldErrors()
                .forEach(e -> errors.put(e.getField(), e.getDefaultMessage()));
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(errors);
    }

    /**
     * Handles {@link IllegalArgumentException} and returns its message as a 400 Bad Request.
     *
     * @param ex the caught {@link IllegalArgumentException}
     * @return a 400 Bad Request response with the exception message
     */
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> handleIllegalArgument(IllegalArgumentException ex) {
        Map<String, String> error = new HashMap<>();
        error.put("message", ex.getMessage());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(error);
    }

    /**
     * Handles malformed or unreadable HTTP request bodies.
     *
     * @param ex the caught {@link HttpMessageNotReadableException}
     * @return a 400 Bad Request response with a generic message
     */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<Map<String, String>> handleMessageNotReadable(HttpMessageNotReadableException ex) {
        Map<String, String> error = new HashMap<>();
        error.put("message", "Unable to process request. Please check your input format.");
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(error);
    }

    /**
     * Handles requests made with an unsupported HTTP method.
     *
     * @param ex the caught {@link HttpRequestMethodNotSupportedException}
     * @return a 405 Method Not Allowed response
     */
    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<Map<String, String>> handleMethodNotSupported(HttpRequestMethodNotSupportedException ex) {
        Map<String, String> error = new HashMap<>();
        error.put("message", "Request method not supported.");
        return ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED).body(error);
    }

    /**
     * Catch-all handler for any unhandled exception. Logs the error and returns a 500 response.
     *
     * @param ex the caught {@link Exception}
     * @return a 500 Internal Server Error response with a generic message
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, String>> handleException(Exception ex) {
        log.error("Unhandled exception: {}", ex.getMessage(), ex);
        Map<String, String> error = new HashMap<>();
        error.put("message", "An unexpected error occurred. Please try again.");
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error);
    }
}
