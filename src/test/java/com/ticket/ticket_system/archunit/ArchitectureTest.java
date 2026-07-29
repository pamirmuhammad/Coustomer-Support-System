package com.ticket.ticket_system.archunit;

import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import org.junit.jupiter.api.Test;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

class ArchitectureTest {

    private final JavaClasses classes = new ClassFileImporter()
            .importPackages("com.ticket.ticket_system");

    @Test
    void services_ShouldNotDependOnControllers() {
        noClasses()
                .that().resideInAPackage("..service..")
                .should().dependOnClassesThat().resideInAPackage("..controller..")
                .check(classes);
    }

    @Test
    void repositories_ShouldBeInterfaces() {
        classes()
                .that().resideInAPackage("..repository..")
                .and().haveSimpleNameEndingWith("Repository")
                .should().beInterfaces()
                .check(classes);
    }

    @Test
    void entities_ShouldNotDependOnServicesOrControllers() {
        noClasses()
                .that().resideInAPackage("..entity..")
                .should().dependOnClassesThat().resideInAPackage("..service..")
                .orShould().dependOnClassesThat().resideInAPackage("..controller..")
                .check(classes);
    }

    @Test
    void productionServices_ShouldBeNamedCorrectly() {
        classes()
                .that().resideInAPackage("com.ticket.ticket_system.service")
                .and().areNotInterfaces()
                .should().haveSimpleNameEndingWith("Service")
                .orShould().haveSimpleNameEndingWith("Sender")
                .orShould().haveSimpleNameEndingWith("Limiter")
                .orShould().haveSimpleNameContaining("Test")
                .check(classes);
    }

    @Test
    void productionControllers_ShouldBeNamedCorrectly() {
        classes()
                .that().resideInAPackage("com.ticket.ticket_system.controller")
                .should().haveSimpleNameEndingWith("Controller")
                .orShould().haveSimpleNameContaining("Test")
                .check(classes);
    }

    @Test
    void dtos_ShouldNotDependOnControllersOrServices() {
        noClasses()
                .that().resideInAPackage("..dto..")
                .should().dependOnClassesThat().resideInAPackage("..controller..")
                .orShould().dependOnClassesThat().resideInAPackage("..service..")
                .check(classes);
    }
}
