-- MySQL dump 10.13  Distrib 8.0.45, for Win64 (x86_64)
--
-- Host: localhost    Database: tutormatch
-- ------------------------------------------------------
-- Server version	8.0.45

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `bookings`
--

DROP TABLE IF EXISTS `bookings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `bookings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `student_id` int NOT NULL,
  `tutor_id` int NOT NULL,
  `course_code` varchar(20) NOT NULL,
  `scheduled_at` datetime DEFAULT NULL,
  `status` enum('pending','confirmed','cancelled','completed') DEFAULT 'pending',
  `payment_status` enum('unpaid','paid','refunded') DEFAULT 'unpaid',
  `message` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `session_type` enum('one_on_one','group','resources') NOT NULL DEFAULT 'one_on_one',
  PRIMARY KEY (`id`),
  KEY `student_id` (`student_id`),
  KEY `tutor_id` (`tutor_id`),
  CONSTRAINT `bookings_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `bookings_ibfk_2` FOREIGN KEY (`tutor_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `bookings`
--

LOCK TABLES `bookings` WRITE;
/*!40000 ALTER TABLE `bookings` DISABLE KEYS */;
INSERT INTO `bookings` VALUES (1,11,12,'CSE 274','2026-04-16 16:05:00','pending','unpaid','','2026-03-08 20:05:49','group'),(2,16,12,'CSE 274','2026-03-23 10:40:00','cancelled','unpaid','','2026-03-09 00:48:19','one_on_one'),(3,15,13,'CSE 274','2026-03-31 11:58:00','cancelled','unpaid','','2026-03-10 01:58:33','group'),(4,15,13,'CSE 274','2026-03-31 11:58:00','cancelled','unpaid','','2026-03-10 01:58:35','group'),(5,16,12,'CIS 453','2026-03-31 15:32:00','cancelled','unpaid','','2026-03-10 02:33:03','one_on_one'),(6,16,15,'PHI 251','2026-03-16 14:48:00','cancelled','unpaid','','2026-03-10 03:48:57','one_on_one'),(7,16,15,'PHI 251','2026-03-27 17:11:00','cancelled','unpaid','','2026-03-10 04:11:47','group'),(8,16,15,'PHI 251','2026-03-16 09:30:00','confirmed','unpaid','','2026-03-10 20:56:30','one_on_one');
/*!40000 ALTER TABLE `bookings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `course_catalog`
--

DROP TABLE IF EXISTS `course_catalog`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `course_catalog` (
  `id` int NOT NULL AUTO_INCREMENT,
  `course_code` varchar(10) NOT NULL,
  `course_name` varchar(255) NOT NULL,
  `department` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_course` (`course_code`)
) ENGINE=InnoDB AUTO_INCREMENT=75 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `course_catalog`
--

LOCK TABLES `course_catalog` WRITE;
/*!40000 ALTER TABLE `course_catalog` DISABLE KEYS */;
INSERT INTO `course_catalog` VALUES (1,'CSE 174','Fundamentals of Programming','Computer Science'),(2,'CSE 274','Data Structures and Algorithms','Computer Science'),(3,'CSE 375','Introduction to Machine Learning','Computer Science'),(4,'CSE 383','Introduction to Database Management Systems','Computer Science'),(5,'CSE 384','Systems Administration','Computer Science'),(6,'CSE 385','Analysis of Algorithms','Computer Science'),(7,'CSE 453','Software Requirements and Specification','Computer Science'),(8,'CSE 464','Introduction to Computer Graphics','Computer Science'),(9,'CSE 472','Operating Systems','Computer Science'),(10,'CSE 473','Automata and Computability','Computer Science'),(11,'CSE 474','Introduction to Network Security','Computer Science'),(12,'CSE 486','Design and Analysis of Algorithms','Computer Science'),(13,'MAT 193','Calculus I','Mathematics'),(14,'MAT 194','Calculus II','Mathematics'),(15,'MAT 295','Calculus III','Mathematics'),(16,'MAT 296','Calculus IV','Mathematics'),(17,'MAT 331','First Course in Linear Algebra','Mathematics'),(18,'MAT 375','Introduction to Abstract Mathematics','Mathematics'),(19,'MAT 397','Calculus of Several Variables','Mathematics'),(20,'MAT 511','Advanced Calculus','Mathematics'),(21,'MAT 521','Introduction to Probability','Mathematics'),(22,'MAT 525','Mathematical Statistics','Mathematics'),(23,'PHY 101','Major Concepts of Physics I','Physics'),(24,'PHY 102','Major Concepts of Physics II','Physics'),(25,'PHY 211','General Physics I','Physics'),(26,'PHY 212','General Physics II','Physics'),(27,'PHY 221','General Physics Laboratory I','Physics'),(28,'PHY 222','General Physics Laboratory II','Physics'),(29,'PHY 315','Quantum Physics I','Physics'),(30,'PHY 316','Quantum Physics II','Physics'),(31,'CHE 106','General Chemistry I','Chemistry'),(32,'CHE 107','General Chemistry II','Chemistry'),(33,'CHE 275','Organic Chemistry I','Chemistry'),(34,'CHE 276','Organic Chemistry II','Chemistry'),(35,'CHE 335','Chemical Analysis','Chemistry'),(36,'CHE 346','Physical Chemistry I','Chemistry'),(37,'CHE 347','Physical Chemistry II','Chemistry'),(38,'BUA 101','Introduction to Business','Business'),(39,'BUA 201','Principles of Accounting I','Business'),(40,'BUA 202','Principles of Accounting II','Business'),(41,'BUA 345','Principles of Finance','Business'),(42,'BUA 353','Introduction to Marketing','Business'),(43,'BUA 454','Business Policy','Business'),(44,'ECN 101','Introductory Microeconomics','Economics'),(45,'ECN 102','Introductory Macroeconomics','Economics'),(46,'ECN 301','Intermediate Microeconomics','Economics'),(47,'ECN 302','Intermediate Macroeconomics','Economics'),(48,'ECN 421','Introduction to Econometrics','Economics'),(49,'ECS 101','Introduction to Engineering and Computer Science','Engineering'),(50,'ELE 231','Electrical Engineering Fundamentals','Engineering'),(51,'ELE 324','Electromagnetics','Engineering'),(52,'CIE 274','Structural Mechanics','Engineering'),(53,'CIE 327','Structural Analysis','Engineering'),(54,'MAE 251','Thermodynamics','Engineering'),(55,'MAE 341','Fluid Mechanics','Engineering'),(56,'ENG 105','Studio 1: Practices of Academic Writing','English'),(57,'ENG 205','Studio 2: Critical Research and Writing','English'),(58,'HIS 101','American History to 1865','History'),(59,'HIS 102','American History Since 1865','History'),(60,'PSY 205','Foundations of Human Behavior','Psychology'),(61,'PSY 274','Social Psychology','Psychology'),(62,'SOC 101','Introduction to Sociology','Sociology'),(63,'PHI 191','The Meaning of Life','Philosophy'),(64,'PHI 251','Logic','Philosophy'),(65,'COM 107','Communications and Society','Communications'),(66,'COM 346','Race, Gender, and the Media','Communications'),(67,'COM 348','Beauty, Bodies, and Media','Communications'),(68,'NEW 205','Communications Law for Journalists','Communications'),(69,'BIO 121','General Biology I','Biology'),(70,'BIO 122','General Biology II','Biology'),(71,'BIO 216','Anatomy and Physiology I','Biology'),(72,'BIO 217','Anatomy and Physiology II','Biology'),(73,'BIO 326','Genetics','Biology'),(74,'BIO 327','Cell Biology','Biology');
/*!40000 ALTER TABLE `course_catalog` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `messages`
--

DROP TABLE IF EXISTS `messages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `messages` (
  `id` int NOT NULL AUTO_INCREMENT,
  `booking_id` int NOT NULL,
  `sender_id` int NOT NULL,
  `content` text NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `read_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `booking_id` (`booking_id`),
  KEY `sender_id` (`sender_id`),
  CONSTRAINT `messages_ibfk_1` FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`id`) ON DELETE CASCADE,
  CONSTRAINT `messages_ibfk_2` FOREIGN KEY (`sender_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `messages`
--

LOCK TABLES `messages` WRITE;
/*!40000 ALTER TABLE `messages` DISABLE KEYS */;
INSERT INTO `messages` VALUES (1,7,15,'? Decline Reason: I\'m sorry, but I\'m not available at that time. I could offer you another time that day, after 5 pm.','2026-03-10 17:55:13','2026-03-10 22:19:21'),(2,6,15,'⚠️ Session Cancellation: I have an emergency, can you reeschedule for another day?','2026-03-10 20:54:27','2026-03-10 22:19:19'),(3,8,16,'Thanks Ms. Gramm, i will see you there','2026-03-10 20:58:12','2026-03-10 20:58:28'),(4,8,15,'See you soon','2026-03-10 20:58:53','2026-03-10 20:59:28');
/*!40000 ALTER TABLE `messages` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notifications`
--

DROP TABLE IF EXISTS `notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notifications` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `type` varchar(50) NOT NULL,
  `title` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `booking_id` int DEFAULT NULL,
  `is_read` tinyint DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `idx_booking_id` (`booking_id`),
  CONSTRAINT `notifications_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notifications`
--

LOCK TABLES `notifications` WRITE;
/*!40000 ALTER TABLE `notifications` DISABLE KEYS */;
INSERT INTO `notifications` VALUES (1,13,'booking_request','? New Booking Request','Alexa Gramm wants to book a session for CSE 274',NULL,0,'2026-03-10 01:58:33'),(2,13,'booking_request','? New Booking Request','Alexa Gramm wants to book a session for CSE 274',NULL,0,'2026-03-10 01:58:35'),(3,12,'booking_request','? New Booking Request','Student Acc wants to book a session for CIS 453',NULL,0,'2026-03-10 02:33:03'),(4,15,'booking_request','? New Booking Request','Student Acc wants to book a session for PHI 251',NULL,1,'2026-03-10 03:48:57'),(5,16,'booking_confirmed','✅ Booking Confirmed!','Alexa Gramm confirmed your session for PHI 251',NULL,1,'2026-03-10 04:07:17'),(6,15,'booking_request','? New Booking Request','Student Acc wants to book a session for PHI 251',7,1,'2026-03-10 04:11:47'),(7,16,'booking_declined','❌ Booking Declined','Alexa Gramm declined your session for PHI 251',NULL,1,'2026-03-10 17:55:13'),(8,16,'new_message','? Message from Tutor','Alexa Gramm sent you a message about your PHI 251 session',NULL,1,'2026-03-10 17:55:13'),(9,16,'session_cancelled','⚠️ Session Canceled by Tutor','Alexa Gramm had to cancel your PHI 251 session',NULL,1,'2026-03-10 20:54:27'),(10,16,'new_message','? Cancellation Message','Alexa Gramm sent you a message about your PHI 251 session cancellation',NULL,1,'2026-03-10 20:54:27'),(11,15,'booking_request','? New Booking Request','Student Acc wants to book a session for PHI 251',8,1,'2026-03-10 20:56:30'),(12,16,'booking_confirmed','✅ Booking Confirmed!','Alexa Gramm confirmed your session for PHI 251',NULL,1,'2026-03-10 20:56:50'),(13,15,'new_message','? New Message','Student Acc sent you a message',8,1,'2026-03-10 20:58:12'),(14,16,'new_message','? New Message','Alexa Gramm sent you a message',8,1,'2026-03-10 20:58:53');
/*!40000 ALTER TABLE `notifications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `payments`
--

DROP TABLE IF EXISTS `payments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `booking_id` int NOT NULL,
  `student_id` int NOT NULL,
  `tutor_id` int NOT NULL,
  `amount` decimal(8,2) NOT NULL,
  `stripe_payment_id` varchar(255) NOT NULL,
  `status` enum('pending','paid','failed','refunded') DEFAULT 'pending',
  `payment_method_last4` varchar(4) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_booking_payment` (`booking_id`),
  KEY `student_id` (`student_id`),
  KEY `tutor_id` (`tutor_id`),
  KEY `status` (`status`),
  CONSTRAINT `payments_ibfk_1` FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`id`) ON DELETE CASCADE,
  CONSTRAINT `payments_ibfk_2` FOREIGN KEY (`student_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `payments_ibfk_3` FOREIGN KEY (`tutor_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payments`
--

LOCK TABLES `payments` WRITE;
/*!40000 ALTER TABLE `payments` DISABLE KEYS */;
/*!40000 ALTER TABLE `payments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `professors`
--

DROP TABLE IF EXISTS `professors`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `professors` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `department` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=41 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `professors`
--

LOCK TABLES `professors` WRITE;
/*!40000 ALTER TABLE `professors` DISABLE KEYS */;
INSERT INTO `professors` VALUES (1,'Dr. Sarah Chen','Computer Science'),(2,'Prof. Michael Rodriguez','Computer Science'),(3,'Dr. Jennifer Kim','Computer Science'),(4,'Prof. David Thompson','Computer Science'),(5,'Dr. Emily Watson','Computer Science'),(6,'Prof. James Liu','Computer Science'),(7,'Dr. Amanda Foster','Computer Science'),(8,'Prof. Robert Clark','Computer Science'),(9,'Dr. Maria Gonzalez','Mathematics'),(10,'Prof. John Anderson','Mathematics'),(11,'Dr. Lisa Park','Mathematics'),(12,'Prof. Steven Miller','Mathematics'),(13,'Dr. Rachel Adams','Mathematics'),(14,'Prof. Kevin Wong','Mathematics'),(15,'Dr. Thomas Brown','Physics'),(16,'Prof. Angela Davis','Physics'),(17,'Dr. Mark Johnson','Physics'),(18,'Prof. Catherine Lee','Physics'),(19,'Dr. Daniel White','Chemistry'),(20,'Prof. Susan Taylor','Chemistry'),(21,'Dr. Christopher Moore','Chemistry'),(22,'Prof. Michelle Garcia','Chemistry'),(23,'Dr. Patricia Wilson','Business'),(24,'Prof. Brian Martinez','Business'),(25,'Dr. Nicole Turner','Business'),(26,'Prof. Anthony Jackson','Business'),(27,'Dr. Karen Phillips','Engineering'),(28,'Prof. William Baker','Engineering'),(29,'Dr. Jessica Rodriguez','Engineering'),(30,'Prof. Ryan Murphy','Engineering'),(31,'Dr. Elizabeth Green','English'),(32,'Prof. Charles Harris','History'),(33,'Dr. Stephanie Clark','Psychology'),(34,'Prof. Matthew Lewis','Philosophy'),(35,'Dr. Laura Robinson','Sociology'),(36,'Prof. Richard King','Communications'),(37,'Dr. Helen Martinez','Biology'),(38,'Prof. Paul Anderson','Economics'),(39,'Dr. Grace Thompson','Chemistry'),(40,'Prof. Frank Wilson','Physics');
/*!40000 ALTER TABLE `professors` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `reviews`
--

DROP TABLE IF EXISTS `reviews`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `reviews` (
  `id` int NOT NULL AUTO_INCREMENT,
  `booking_id` int NOT NULL,
  `rating` tinyint NOT NULL,
  `comment` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `booking_id` (`booking_id`),
  CONSTRAINT `reviews_ibfk_1` FOREIGN KEY (`booking_id`) REFERENCES `bookings` (`id`) ON DELETE CASCADE,
  CONSTRAINT `reviews_chk_1` CHECK ((`rating` between 1 and 5))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `reviews`
--

LOCK TABLES `reviews` WRITE;
/*!40000 ALTER TABLE `reviews` DISABLE KEYS */;
/*!40000 ALTER TABLE `reviews` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sessions`
--

DROP TABLE IF EXISTS `sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sessions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tutor_id` int DEFAULT NULL,
  `student_id` int DEFAULT NULL,
  `session_date` datetime DEFAULT NULL,
  `duration` int DEFAULT NULL,
  `status` enum('pending','completed','cancelled') DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `tutor_id` (`tutor_id`),
  KEY `student_id` (`student_id`),
  CONSTRAINT `sessions_ibfk_1` FOREIGN KEY (`tutor_id`) REFERENCES `users` (`id`),
  CONSTRAINT `sessions_ibfk_2` FOREIGN KEY (`student_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sessions`
--

LOCK TABLES `sessions` WRITE;
/*!40000 ALTER TABLE `sessions` DISABLE KEYS */;
/*!40000 ALTER TABLE `sessions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tutor_courses`
--

DROP TABLE IF EXISTS `tutor_courses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tutor_courses` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tutor_id` int NOT NULL,
  `course_code` varchar(20) NOT NULL,
  `course_name` varchar(150) NOT NULL,
  `professor` varchar(100) DEFAULT NULL,
  `grade` varchar(5) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `tutor_id` (`tutor_id`),
  CONSTRAINT `tutor_courses_ibfk_1` FOREIGN KEY (`tutor_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tutor_courses`
--

LOCK TABLES `tutor_courses` WRITE;
/*!40000 ALTER TABLE `tutor_courses` DISABLE KEYS */;
INSERT INTO `tutor_courses` VALUES (1,12,'CSE 384','Systems & Network Programming','Dr. Wills','A'),(2,12,'CSE 274','Data Structures','Dr. Wills','A'),(3,12,'CIS 453','Software Analysis & Design','Dr. Johnson','A-'),(4,13,'ECS 315','Electric Circuits','Dr. Smith','A'),(5,13,'ECS 326','Digital Logic','Dr. Smith','A'),(6,13,'CSE 274','Data Structures','Dr. Wills','B+'),(7,14,'CSE 101','Introduction to Programming','Dr. Lee','A'),(8,14,'CSE 175','Intro to Computer Science','Dr. Lee','A'),(9,14,'MAT 295','Calculus I','Dr. Brown','A-'),(10,15,'PHI 251','Logic','Dr. Sarah Chen','A+');
/*!40000 ALTER TABLE `tutor_courses` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tutor_profiles`
--

DROP TABLE IF EXISTS `tutor_profiles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tutor_profiles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `bio` text,
  `hourly_rate` decimal(6,2) DEFAULT '0.00',
  `is_verified` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_id` (`user_id`),
  CONSTRAINT `tutor_profiles_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tutor_profiles`
--

LOCK TABLES `tutor_profiles` WRITE;
/*!40000 ALTER TABLE `tutor_profiles` DISABLE KEYS */;
INSERT INTO `tutor_profiles` VALUES (4,12,'Former TA for CSE 384 and CSE 274. I break down complex algorithms into simple steps.',25.00,1,'2026-03-08 08:35:21'),(5,13,'Graduated with a 3.9 GPA in Computer Engineering. Specialized in circuits and systems.',30.00,1,'2026-03-08 08:35:21'),(6,14,'Senior CS student. Tutored 20+ students in intro programming courses.',20.00,0,'2026-03-08 08:35:21'),(7,15,'',25.00,0,'2026-03-08 20:53:15');
/*!40000 ALTER TABLE `tutor_profiles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tutors`
--

DROP TABLE IF EXISTS `tutors`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tutors` (
  `user_id` int NOT NULL,
  `bio` text,
  `hourly_rate` decimal(10,2) DEFAULT NULL,
  `subjects` varchar(255) DEFAULT NULL,
  `rating` decimal(2,1) DEFAULT '0.0',
  PRIMARY KEY (`user_id`),
  CONSTRAINT `tutors_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tutors`
--

LOCK TABLES `tutors` WRITE;
/*!40000 ALTER TABLE `tutors` DISABLE KEYS */;
/*!40000 ALTER TABLE `tutors` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `full_name` varchar(100) NOT NULL,
  `email` varchar(150) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role` enum('student','tutor') NOT NULL DEFAULT 'student',
  `university` varchar(150) DEFAULT 'Syracuse University',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (6,'Ana Ramírez','ana@email.com','hash123','student','Universidad Nacional','2026-03-08 08:01:28'),(7,'Carlos Mendoza','carlos@email.com','hash456','tutor','Syracuse University','2026-03-08 08:01:28'),(8,'Laura Castillo','laura@email.com','hash789','student','Universidad de Buenos Aires','2026-03-08 08:01:28'),(9,'Diego Fernández','diego@email.com','hash012','tutor','Syracuse University','2026-03-08 08:01:45'),(10,'María González','maria@email.com','hash345','student',NULL,'2026-03-08 08:01:45'),(11,'Testmail','test@syr.edu','$2b$12$FOu.pdJsthydZhxQaItwluKK3YUdWiLoFMUs4R9UYcUbpgrlmSAJC','student','Syracuse University','2026-03-08 08:21:38'),(12,'Alex Johnson','alex@syr.edu','$2b$12$placeholderhashAAAAAAAAAAAAAAAAAAAAAAAAAAA','tutor','Syracuse University','2026-03-08 08:34:38'),(13,'Maria Garcia','maria@syr.edu','$2b$12$placeholderhashBBBBBBBBBBBBBBBBBBBBBBBBB','tutor','Syracuse University','2026-03-08 08:34:38'),(14,'James Wilson','james@syr.edu','$2b$12$placeholderhashCCCCCCCCCCCCCCCCCCCCCCCCC','tutor','Syracuse University','2026-03-08 08:34:38'),(15,'Alexa Gramm','alexa@syr.edu','$2b$12$/wrtFsNB9aO2VHDj/RIOBu0Tx335R7UA6AmQv5uZ8mbbhIYZWiwq2','tutor','Syracuse University','2026-03-08 20:53:15'),(16,'Student Acc','student@syr.edu','$2b$12$FQ/guxwmQMmIw8sP9zfS1uJ7SknF6pEMTE2JNUJdLZ4lB.aCsshI6','student','Syracuse University','2026-03-08 22:03:32');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-03-10 19:57:05
