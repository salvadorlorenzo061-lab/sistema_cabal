-- Add separate cellphone fields requested for COCODE and user records.
ALTER TABLE afiliados
    ADD COLUMN numero_celular VARCHAR(25) DEFAULT NULL AFTER telefono;

ALTER TABLE usuarios
    ADD COLUMN numero_celular VARCHAR(25) DEFAULT NULL AFTER correo;